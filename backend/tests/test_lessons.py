"""Run with: docker compose run --rm backend python -m unittest discover tests  (or locally: cd backend && python -m unittest discover tests)"""
import unittest

from app.conversation import SCENARIOS
from app.lesson_engine import (
    WORD_FILES, ai_hint, build_lesson, compare, level_lessons, load_words, plain_tip, tip_is_sound,
)


def lesson(level, *results):
    return {"level": level, "results": [{"word": w, "correct": ok} for w, ok in results]}


class WordLists(unittest.TestCase):
    def test_every_word_has_a_valid_article_and_translation(self):
        for level in WORD_FILES:
            for word, row in load_words(level).items():
                self.assertIn(row["article"], ("de", "het"), word)
                self.assertTrue(row["english"], word)

    def test_a_word_is_in_only_one_level(self):
        levels = list(WORD_FILES)
        for i, a in enumerate(levels):
            for b in levels[i + 1:]:
                self.assertFalse(load_words(a).keys() & load_words(b).keys(), f"{a} and {b} share words")

    def test_every_level_has_a_word_list_and_scenarios(self):
        for level in ("A1", "A2", "B1"):
            self.assertIn(level, WORD_FILES)
            self.assertGreaterEqual(len(load_words(level)), 100, level)
            self.assertTrue(SCENARIOS[level], level)

    def test_scenarios_only_use_known_words(self):
        words = load_words()
        for level, scenarios in SCENARIOS.items():
            for s in scenarios:
                self.assertEqual([w for w in s["words"] if w not in words], [], s["id"])


class Levels(unittest.TestCase):
    def test_old_lessons_without_a_level_count_as_a1(self):
        history = {"lessons": [{"results": []}, lesson("A2")]}
        self.assertEqual(len(level_lessons(history, "A1")), 1)
        self.assertEqual(len(level_lessons(history, "A2")), 1)

    def test_mistakes_only_come_back_in_their_own_level(self):
        history = {"lessons": [lesson("A1", ("huis", False)), lesson("A2", ("trui", False))]}
        _, wrong_a1 = build_lesson(load_words("A1"), history, "A1")
        _, wrong_a2 = build_lesson(load_words("A2"), history, "A2")
        self.assertEqual(wrong_a1, ["huis"])
        self.assertEqual(wrong_a2, ["trui"])

    def test_lessons_stay_inside_their_level(self):
        words = load_words("A2")
        groups, _ = build_lesson(words, {"lessons": []}, "A2")
        self.assertTrue(all(w in words for group in groups for w in group))

    def test_score_compares_with_the_same_level(self):
        history = {"lessons": [lesson("A1", ("huis", True)), lesson("A2", ("trui", False))]}
        self.assertEqual(compare(history, [], [], "A1")["previous"], 1)
        self.assertEqual(compare(history, [], [], "A2")["previous"], 0)


class Tips(unittest.TestCase):
    def test_invented_rules_are_rejected(self):
        for tip, word, article in [
            ("Words ending in -en often share the het pattern.", "varken", "het"),
            ("Words ending in -um are always het.", "museum", "het"),
            ("Most common objects in the house use de.", "stoel", "de"),
            ("Think of common everyday furniture objects that take de.", "stoel", "de"),
            ("Many animals take het.", "varken", "het"),
        ]:
            self.assertFalse(tip_is_sound(tip, word, article), tip)

    def test_wrong_article_and_run_together_words_are_rejected(self):
        self.assertFalse(tip_is_sound("Picture de hotel at night.", "hotel", "het"))
        self.assertFalse(tip_is_sound("Imagine sleeping inhet bed.", "weekend", "het"))

    def test_good_tips_pass(self):
        for tip, word, article in [
            ("Words ending in -je are always het.", "meisje", "het"),
            ("Words ending in -ing are de.", "wandeling", "de"),
            ("Imagine sleeping in het cozy bed at het hotel.", "hotel", "het"),
            ("Picture a wide-open door on de week.", "week", "de"),
        ]:
            self.assertTrue(tip_is_sound(tip, word, article), tip)

    def test_a_real_rule_on_the_wrong_word_is_rejected(self):
        self.assertFalse(tip_is_sound("Words ending in -je are always het.", "hotel", "het"))

    def test_plain_tips_pass_the_check_themselves(self):
        for verdict, word, article in [("pattern", "stoel", "de"), ("default", "taal", "de"), ("memorize", "hotel", "het")]:
            tip = plain_tip({"word": word, "article": article, "verdict": verdict})
            self.assertTrue(tip_is_sound(tip, word, article), tip)


class Verdicts(unittest.TestCase):
    def test_a_wrong_guess_is_never_called_a_pattern(self):
        words = load_words()
        for word, row in words.items():
            result = ai_hint(word, row["article"])
            self.assertIn(result["verdict"], ("pattern", "default", "memorize"))
            if "wrong way" in result["hint"]:
                self.assertNotEqual(result["verdict"], "pattern", word)

    def test_de_is_only_called_the_default_for_de_words(self):
        for word, row in load_words().items():
            if ai_hint(word, row["article"])["verdict"] == "default":
                self.assertEqual(row["article"], "de", word)


class BrokenModel(unittest.TestCase):
    def test_a_model_file_in_another_format_falls_back_instead_of_crashing(self):
        import tempfile, torch
        from unittest.mock import patch
        from app import lesson_engine

        with tempfile.TemporaryDirectory() as d:
            bad = f"{d}/dehet_model.pt"
            torch.save({"vocab": {"a": 2}, "something_else": 1}, bad)
            with patch.object(lesson_engine, "MODEL_FILE", __import__("pathlib").Path(bad)), \
                 patch.object(lesson_engine, "_networks", None), \
                 patch.object(lesson_engine, "_model_missing", False):
                self.assertFalse(lesson_engine.model_available())
                self.assertEqual(ai_hint("stoel", "de")["verdict"], "default")
                self.assertEqual(ai_hint("huis", "het")["verdict"], "memorize")


if __name__ == "__main__":
    unittest.main()
