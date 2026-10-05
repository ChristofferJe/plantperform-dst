import unittest

from app.services.nles5.bridge_v2 import _resolve_mp, _resolve_w

GRAES = 252
VINTERHVEDE = 11
VAARBYG = 1
MAJS = 5

GRAES_PARAMS = {"M": 4, "W": 6, "MP": 3}
VINTERHVEDE_PARAMS = {"M": 1, "W": None, "MP": 1}
VAARBYG_PARAMS = {"M": 2, "W": None, "MP": 2}
MAJS_PARAMS = {"M": 8, "W": 3, "MP": 2}


class ResolveMpTest(unittest.TestCase):
    """græs -> vinterhvede -> vårbyg: MP4 belongs to the vårbyg, not the vinterhvede."""

    def test_afgroede_right_after_graes_gets_the_graes_mp(self) -> None:
        self.assertEqual(_resolve_mp(GRAES_PARAMS, GRAES, VAARBYG), 3)

    def test_afgroede_two_years_after_graes_gets_mp4(self) -> None:
        self.assertEqual(_resolve_mp(VINTERHVEDE_PARAMS, VINTERHVEDE, GRAES), 4)

    def test_forfrugt_outside_the_mp4_list_keeps_its_own_mp(self) -> None:
        self.assertEqual(_resolve_mp({"MP": 2}, 999, GRAES), 2)

    def test_no_langvarig_forforfrugt_keeps_the_forfrugt_mp(self) -> None:
        self.assertEqual(_resolve_mp(VAARBYG_PARAMS, VAARBYG, VINTERHVEDE), 2)


class ResolveWTest(unittest.TestCase):
    """W belongs to the græs year, decided by what is sown after it."""

    def test_graes_before_vintersaed_is_w7(self) -> None:
        w = _resolve_w(GRAES, GRAES_PARAMS, VINTERHVEDE, VINTERHVEDE_PARAMS, None)
        self.assertEqual(w, 7)

    def test_graes_before_spring_crop_is_w8(self) -> None:
        w = _resolve_w(GRAES, GRAES_PARAMS, VAARBYG, VAARBYG_PARAMS, None)
        self.assertEqual(w, 8)

    def test_graes_before_majs_is_w8(self) -> None:
        w = _resolve_w(GRAES, GRAES_PARAMS, MAJS, MAJS_PARAMS, None)
        self.assertEqual(w, 8)

    def test_vintersaed_after_graes_does_not_get_w7_itself(self) -> None:
        w = _resolve_w(VINTERHVEDE, VINTERHVEDE_PARAMS, VAARBYG, VAARBYG_PARAMS, None)
        self.assertEqual(w, 5)

    def test_crop_that_is_not_langvarig_keeps_the_next_year_w(self) -> None:
        w = _resolve_w(VAARBYG, VAARBYG_PARAMS, VINTERHVEDE, VINTERHVEDE_PARAMS, None)
        self.assertEqual(w, 1)


if __name__ == "__main__":
    unittest.main()
