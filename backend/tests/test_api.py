"""HTTP tests for the AI service. Gemini is replaced by a stub, so these run offline.
Run with: python -m unittest discover tests"""
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import main
from app.lesson_engine import load_words

client = TestClient(main.app)


def no_tips(mistakes):
    return {}


class Health(unittest.TestCase):
    def test_health_reports_levels(self):
        body = client.get("/health").json()
        self.assertEqual(body["status"], "ok")
        self.assertIn("A1", body["levels"])


class BuildLesson(unittest.TestCase):
    def test_a_new_learner_gets_twelve_words_in_groups_of_four(self):
        body = client.post("/lesson/build", json={"level": "A1", "history": []}).json()
        self.assertEqual(body["lesson_number"], 1)
        self.assertEqual([len(g) for g in body["groups"]], [4, 4, 4])
        words = load_words("A1")
        for group in body["groups"]:
            for w in group:
                self.assertIn(w["word"], words)
                self.assertNotIn("article", w)  # the answer is never sent to the browser

    def test_last_mistakes_come_back(self):
        history = [{"level": "A1", "results": [{"word": "huis", "guess": "de", "correct": False}]}]
        body = client.post("/lesson/build", json={"level": "A1", "history": history}).json()
        self.assertEqual(body["last_wrong"], ["huis"])
        self.assertEqual(body["lesson_number"], 2)
        self.assertIn("huis", [w["word"] for g in body["groups"] for w in g])

    def test_unknown_level_is_404(self):
        self.assertEqual(client.post("/lesson/build", json={"level": "C2"}).status_code, 404)


@patch.object(main, "gemini_tips", no_tips)
class GradeLesson(unittest.TestCase):
    def test_answers_are_checked_against_the_word_list(self):
        body = client.post("/lesson/grade", json={
            "level": "A1",
            "answers": [{"word": "huis", "guess": "het"}, {"word": "stoel", "guess": "het"}],
        }).json()
        self.assertEqual(body["score"], 1)
        self.assertEqual(body["total"], 2)
        self.assertEqual([m["word"] for m in body["mistakes"]], ["stoel"])
        self.assertEqual(body["mistakes"][0]["article"], "de")
        self.assertTrue(body["mistakes"][0]["ai_hint"])

    def test_fixed_words_are_reported(self):
        history = [{"level": "A1", "results": [{"word": "huis", "guess": "de", "correct": False}]}]
        body = client.post("/lesson/grade", json={
            "level": "A1", "answers": [{"word": "huis", "guess": "het"}],
            "last_wrong": ["huis"], "history": history,
        }).json()
        self.assertEqual(body["fixed"], ["huis"])
        self.assertEqual(body["previous"], 0)

    def test_words_from_another_level_are_rejected(self):
        res = client.post("/lesson/grade", json={"level": "A1", "answers": [{"word": "trui", "guess": "de"}]})
        self.assertEqual(res.status_code, 400)


class Scenarios(unittest.TestCase):
    def test_scenarios_list_their_words_with_articles(self):
        body = client.get("/conversation/scenarios?level=A1").json()
        self.assertTrue(body["scenarios"])
        for s in body["scenarios"]:
            for w in s["words"]:
                self.assertIn(w["article"], ("de", "het"))


if __name__ == "__main__":
    unittest.main()
