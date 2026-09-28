import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from pydantic import ValidationError

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://dst2:dst2@localhost:5432/dst2",
)

from app.data import repository
from app.domain.rotation_candidate import (
    RotationCandidateEvaluation,
    RotationCandidateRef,
    RotationCandidateYearResult,
    RotationYear,
)
from app.domain.simulation import (
    CreateSimulationRequest,
    CropAreaLimit,
    OptimizationConstraints,
    Simulation,
)
from app.services.optimization.engine import solve
from app.services.optimization.models import (
    NUM_YEARS,
    ConstraintsInput,
    FieldInput,
    FixedFieldContribution,
    FixedYearlyFieldContribution,
    OptimizationInput,
    RotationOption,
    YearlyConstraintsInput,
    YearlyFieldInput,
    YearlyOptimizationInput,
    YearlyRotationOption,
)
from app.services.optimization.orchestrator import (
    _locked_field_contribution,
    _locked_yearly_field_contribution,
    _selected_locked_candidate,
)
from app.services.optimization.yearly_engine import solve_yearly


def _year(code: int) -> RotationYear:
    return RotationYear(afgrode_kode=code, afgrode_navn=str(code))


def _candidate(key: str, codes: tuple[int, ...]) -> RotationCandidateEvaluation:
    repeated = (codes * NUM_YEARS)[:NUM_YEARS]
    return RotationCandidateEvaluation(
        ref=RotationCandidateRef(saedskiftevariant=key, variant="1", n_norm_pct="100"),
        active_len=len(codes),
        years=[
            RotationCandidateYearResult(
                year=_year(code), leaching_kg_n_ha=0, leaching_detail={},
                db_kr_ha=0, db_detail={},
            )
            for code in repeated
        ],
        avg_leaching_kg_n_ha=0,
        avg_db_kr_ha=0,
        avg_fen=0,
    )


def _run(
    yearly: bool,
    fields: list[tuple[str, float, list[tuple[str, tuple[int, ...], float]]]],
    limits: tuple[CropAreaLimit, ...] = (),
    fixed: tuple[tuple[float, tuple[int, ...], bool], ...] = (),
):
    if yearly:
        field_inputs = tuple(
            YearlyFieldInput(
                id=field_id, area_ha=area, kystvand_id=None,
                options=tuple(
                    YearlyRotationOption(
                        key=key, id=key, candidate=_candidate(key, codes),
                        years=tuple(_year(code) for code in codes),
                        db2_by_year=(db2,) * NUM_YEARS,
                        n_load_by_year=(0.0,) * NUM_YEARS,
                        leaching_by_year=(0.0,) * NUM_YEARS,
                        fen=0,
                    )
                    for key, codes, db2 in options
                ),
            )
            for field_id, area, options in fields
        )
        fixed_inputs = tuple(
            FixedYearlyFieldContribution(
                kystvand_id=None, db2_by_year=(0.0,) * NUM_YEARS,
                n_load_by_year=(0.0,) * NUM_YEARS,
                leaching_by_year=(0.0,) * NUM_YEARS, fen=0,
                kvotegivende=quota_eligible, area_ha=area,
                crop_codes_by_year=(codes * NUM_YEARS)[:NUM_YEARS],
            )
            for area, codes, quota_eligible in fixed
        )
        return solve_yearly(YearlyOptimizationInput(
            fields=field_inputs, fixed_fields=fixed_inputs,
            constraints=YearlyConstraintsInput(
                max_n_load_by_kystvandopland_and_year={},
                db2_swing_pct=None, min_fen=None, max_fen=None,
                crop_area_limits=limits,
            ),
            time_limit_seconds=5,
        ))

    field_inputs = tuple(
        FieldInput(
            id=field_id, area_ha=area, kystvand_id=None,
            options=tuple(
                RotationOption(
                    key=key, id=key, years=tuple(_year(code) for code in codes),
                    db2=db2, n_load=0, leaching=0, fen=0,
                )
                for key, codes, db2 in options
            ),
        )
        for field_id, area, options in fields
    )
    fixed_inputs = tuple(
        FixedFieldContribution(
            kystvand_id=None, db2=0, n_load=0, leaching=0, fen=0,
            kvotegivende=quota_eligible, area_ha=area, crop_codes_by_year=codes,
        )
        for area, codes, quota_eligible in fixed
    )
    return solve(OptimizationInput(
        fields=field_inputs, fixed_fields=fixed_inputs,
        constraints=ConstraintsInput(
            max_n_load_by_kystvandopland={}, min_fen=None, max_fen=None,
            crop_area_limits=limits,
        ),
        time_limit_seconds=5,
    ))


class CropAreaSolverTests(unittest.TestCase):
    def test_minimum_maximum_and_multiple_codes(self) -> None:
        fields = [
            ("a", 5, [("a1", (1,), 10), ("a2", (2,), 20)]),
            ("b", 3, [("b1", (1,), 20), ("b2", (2,), 10)]),
        ]
        limits = (
            CropAreaLimit(afgrode_kode=1, min_area_ha=5, max_area_ha=5),
            CropAreaLimit(afgrode_kode=2, min_area_ha=3, max_area_ha=3),
        )
        for yearly in (False, True):
            with self.subTest(yearly=yearly):
                output = _run(yearly, fields, limits)
                self.assertEqual(output.status, "OPTIMAL")
                self.assertEqual(
                    {assignment.rotation_id for assignment in output.assignments},
                    {"a1", "b2"},
                )

    def test_single_sided_bounds_and_no_limits(self) -> None:
        cases = (
            (CropAreaLimit(afgrode_kode=1, min_area_ha=4), "crop1"),
            (CropAreaLimit(afgrode_kode=1, max_area_ha=0), "crop2"),
        )
        for yearly in (False, True):
            fields = [("a", 4, [("crop1", (1,), 20), ("crop2", (2,), 10)])]
            with self.subTest(yearly=yearly, bounds="none"):
                self.assertEqual(_run(yearly, fields).assignments[0].rotation_id, "crop1")
            for limit, expected in cases:
                with self.subTest(yearly=yearly, bounds=limit):
                    output = _run(yearly, fields, (limit,))
                    self.assertEqual(output.status, "OPTIMAL")
                    self.assertEqual(output.assignments[0].rotation_id, expected)

    def test_impossible_bounds_are_infeasible(self) -> None:
        fields = [("a", 4, [("crop1", (1,), 10)])]
        for yearly in (False, True):
            for limit in (
                CropAreaLimit(afgrode_kode=1, min_area_ha=5),
                CropAreaLimit(afgrode_kode=1, max_area_ha=3),
            ):
                with self.subTest(yearly=yearly, bounds=limit):
                    self.assertEqual(_run(yearly, fields, (limit,)).status, "INFEASIBLE")

    def test_standard_solver_repeats_cycles_through_2034(self) -> None:
        # The first three years meet the minimum; the two cycles align without
        # crop 1 in the fourth year.
        fields = [
            ("a", 5, [("two_year", (1, 2), 10)]),
            ("b", 5, [("three_year", (2, 1, 2), 10)]),
        ]
        output = _run(False, fields, (CropAreaLimit(afgrode_kode=1, min_area_ha=5),))
        self.assertEqual(output.status, "INFEASIBLE")

    def test_yearly_solver_uses_shifted_eight_year_sequences(self) -> None:
        fields = [
            ("a", 5, [("a_start_1", (1, 2), 20), ("a_start_2", (2, 1), 10)]),
            ("b", 5, [("b_start_1", (1, 2), 20), ("b_start_2", (2, 1), 10)]),
        ]
        limit = CropAreaLimit(afgrode_kode=1, min_area_ha=5, max_area_ha=5)
        output = _run(True, fields, (limit,))
        self.assertEqual(output.status, "OPTIMAL")
        self.assertEqual(
            sum(assignment.rotation_id.endswith("start_1") for assignment in output.assignments),
            1,
        )

    def test_locked_fields_count_even_when_not_quota_eligible(self) -> None:
        fields = [("free", 6, [("crop1", (1,), 20), ("crop2", (2,), 10)])]
        fixed = ((4, (1,), False),)
        limit = CropAreaLimit(afgrode_kode=1, min_area_ha=4, max_area_ha=4)
        for yearly in (False, True):
            with self.subTest(yearly=yearly):
                output = _run(yearly, fields, (limit,), fixed)
                self.assertEqual(output.status, "OPTIMAL")
                self.assertEqual(output.assignments[0].rotation_id, "crop2")

    def test_locked_fields_use_selected_candidate_crop_codes(self) -> None:
        first, selected = _candidate("first", (1,)), _candidate("selected", (2,))
        field = SimpleNamespace(
            rotation_id=selected.ref.to_id(),
            allowed_rotation_ids=[first.ref.to_id(), selected.ref.to_id()],
            kystvand_id=None, db2=0, n_load=0, leaching=0, fen=0,
            kvotegivende=False, area_ha=4, retention=None,
        )
        self.assertIs(_selected_locked_candidate(field, [first, selected]), selected)
        self.assertIsNone(_selected_locked_candidate(field, [first]))
        standard = _locked_field_contribution(field, selected)
        yearly = _locked_yearly_field_contribution(field, [first, selected])
        self.assertEqual(standard.crop_codes_by_year, (2,))
        self.assertEqual(yearly.crop_codes_by_year, (2,) * NUM_YEARS)


class CropAreaPersistenceTests(unittest.TestCase):
    def test_validation_and_camel_case_wire_shape(self) -> None:
        request = CreateSimulationRequest.model_validate({
            "name": "Annual limits",
            "constraints": {"cropAreaLimits": [
                {"afgrodeKode": 1, "minAreaHa": 2.5, "maxAreaHa": 7.5},
            ]},
        })
        self.assertEqual(request.constraints.crop_area_limits[0].afgrode_kode, 1)
        self.assertEqual(
            request.model_dump(mode="json", by_alias=True)["constraints"]["cropAreaLimits"],
            [{"afgrodeKode": 1, "minAreaHa": 2.5, "maxAreaHa": 7.5}],
        )
        old_request = CreateSimulationRequest(name="Old client")
        self.assertEqual(old_request.constraints.crop_area_limits, [])
        self.assertEqual(Simulation(
            id="s", farm_id="f", name="Legacy", created_at="now",
        ).constraints.crop_area_limits, [])
        for invalid in (
            {"afgrodeKode": 1},
            {"afgrodeKode": 1, "minAreaHa": -1},
            {"afgrodeKode": 1, "minAreaHa": 3, "maxAreaHa": 2},
            {"afgrodeKode": 1, "maxAreaHa": float("inf")},
        ):
            with self.subTest(invalid=invalid), self.assertRaises(ValidationError):
                CropAreaLimit.model_validate(invalid)
        with self.assertRaises(ValidationError):
            OptimizationConstraints.model_validate({"cropAreaLimits": [
                {"afgrodeKode": 1, "minAreaHa": 1},
                {"afgrodeKode": 1, "maxAreaHa": 2},
            ]})

    def test_create_persists_optional_constraints(self) -> None:
        request = CreateSimulationRequest.model_validate({
            "name": "New",
            "constraints": {"cropAreaLimits": [{"afgrodeKode": 1, "minAreaHa": 3}]},
        })
        with (
            patch.object(repository, "SessionLocal") as factory,
            patch.object(repository, "_farm_exists", return_value=True),
        ):
            session = factory.begin.return_value.__enter__.return_value
            session.execute.return_value.scalars.return_value.all.return_value = []
            created = repository.create_simulation("farm", request, "member@example.com")
            inserted = session.execute.call_args_list[0].args[0].compile().params["data"]
        self.assertEqual(created.constraints.crop_area_limits[0].min_area_ha, 3)
        self.assertEqual(inserted["constraints"]["crop_area_limits"][0]["afgrode_kode"], 1)

    def test_partial_patch_preserves_other_rules_and_explicit_empty_clears(self) -> None:
        saved = Simulation(
            id="s", farm_id="f", name="Existing", created_at="now",
            constraints=OptimizationConstraints(min_fen=10, max_fields_with_new_rotation=999),
        )

        def patch_constraints(simulation: Simulation, payload: dict) -> Simulation:
            with (
                patch.object(repository, "SessionLocal") as factory,
                patch.object(repository, "_get_simulation", return_value=simulation),
            ):
                session = factory.begin.return_value.__enter__.return_value
                session.execute.return_value.scalar_one.return_value = 1
                return repository.update_simulation_constraints(
                    "f", "s", OptimizationConstraints.model_validate(payload),
                    "member@example.com",
                )

        with_limit = patch_constraints(saved, {
            "cropAreaLimits": [{"afgrodeKode": 2, "maxAreaHa": 4}],
        })
        self.assertEqual(with_limit.constraints.min_fen, 10)
        self.assertEqual(with_limit.constraints.crop_area_limits[0].max_area_ha, 4)
        old_client_patch = patch_constraints(with_limit, {"minFen": 12})
        self.assertEqual(
            old_client_patch.constraints.crop_area_limits,
            with_limit.constraints.crop_area_limits,
        )
        cleared = patch_constraints(old_client_patch, {"cropAreaLimits": []})
        self.assertEqual(cleared.constraints.crop_area_limits, [])
        self.assertEqual(cleared.constraints.min_fen, 12)


if __name__ == "__main__":
    unittest.main()
