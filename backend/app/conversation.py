import os
import re
import time

from app.lesson_engine import load_words


# ---------- Levels ----------
# How Gemini should pitch its Dutch at each CEFR level.
LEVELS = {
    "A1": (
        "The learner is CEFR A1 (absolute beginner). Use very short sentences (max ~8 words), "
        "present tense only, high-frequency words, and ask ONE simple question per turn. "
        "Speak slowly and clearly, like to a tourist."
    ),
    "A2": (
        "The learner is CEFR A2. Use short everyday sentences, present and simple past "
        "(perfectum), and common connectors (en, maar, want, omdat). One or two questions per turn."
    ),
    "B1": (
        "The learner is CEFR B1. Speak natural everyday Dutch at a normal pace, use all common "
        "tenses, ask open questions and ask the learner to explain or give opinions."
    ),
}


# ---------- Scenarios ----------
# Each scenario reuses nouns from wordsA1.csv and wordsA2.csv so the conversations practise
# the same vocabulary (and de/het articles) as the lessons.
SCENARIOS = {
    "A1": [
        {
            "id": "voorstellen",
            "title": "Jezelf voorstellen",
            "title_en": "Introducing yourself",
            "description": "First day at language school. A classmate wants to get to know you.",
            "ai_role": "Sanne, a friendly classmate at a Dutch language school in Utrecht",
            "user_role": "a new student on their first day at the language school",
            "opening": "Say hi and ask the learner who they are.",
            "goal": "Tell Sanne your name, which country you are from, which language(s) you speak and where you live.",
            "words": ["school", "leraar", "land", "taal", "stad", "vriend", "adres"],
            "phrases": [
                ["Ik heet ...", "My name is ..."],
                ["Ik kom uit ...", "I come from ..."],
                ["Ik spreek ...", "I speak ..."],
                ["Ik woon in ...", "I live in ..."],
                ["En jij?", "And you?"],
            ],
        },
        {
            "id": "cafe",
            "title": "In het café",
            "title_en": "At the café",
            "description": "You're hungry and thirsty. Order something from the waiter.",
            "ai_role": "Daan, a waiter in a cosy café in Amsterdam",
            "user_role": "a customer who just sat down in the café",
            "opening": "Welcome the customer and ask what they would like.",
            "goal": "Order one drink and one thing to eat, then ask for the bill.",
            "words": ["koffie", "thee", "water", "bier", "melk", "brood", "kaas", "soep", "restaurant"],
            "phrases": [
                ["Mag ik een ..., alstublieft?", "May I have a ..., please?"],
                ["Ik wil graag ...", "I would like ..."],
                ["Met melk, graag.", "With milk, please."],
                ["Mag ik betalen?", "Can I pay?"],
                ["Dank u wel!", "Thank you!"],
            ],
        },
        {
            "id": "markt",
            "title": "Op de markt",
            "title_en": "At the market",
            "description": "Saturday market. Buy some groceries at a market stall.",
            "ai_role": "Henk, a cheerful market vendor selling fruit, cheese and bread",
            "user_role": "a shopper walking up to your market stall",
            "opening": "Greet the shopper and ask what they would like.",
            "goal": "Buy at least two items, ask how much it costs, and pay.",
            "words": ["appel", "fruit", "kaas", "brood", "ei", "melk", "geld", "tas"],
            "phrases": [
                ["Ik wil graag twee appels.", "I would like two apples."],
                ["Hoeveel kost dat?", "How much does that cost?"],
                ["Dat is alles.", "That's everything."],
                ["Kan ik pinnen?", "Can I pay by card?"],
                ["Heeft u een tas?", "Do you have a bag?"],
            ],
        },
        {
            "id": "weg-vragen",
            "title": "De weg vragen",
            "title_en": "Asking for directions",
            "description": "You're lost in a Dutch city. Ask a passer-by for help.",
            "ai_role": "Fatima, a helpful local walking her dog in the city centre",
            "user_role": "a lost tourist who needs directions",
            "opening": "Notice the learner looks lost and ask if you can help. Do NOT mention any place yourself; wait for the learner to ask where something is.",
            "goal": "Ask where the station (or another place) is and check that you understood the directions.",
            "words": ["station", "museum", "ziekenhuis", "park", "hotel", "straat", "stad", "fiets"],
            "phrases": [
                ["Pardon, waar is het station?", "Excuse me, where is the station?"],
                ["Is het ver?", "Is it far?"],
                ["Rechtdoor / links / rechts", "Straight ahead / left / right"],
                ["Kunt u dat herhalen?", "Can you repeat that?"],
                ["Bedankt voor uw hulp!", "Thanks for your help!"],
            ],
        },
        {
            "id": "familie",
            "title": "Mijn familie",
            "title_en": "My family",
            "description": "A new friend asks about your family and pets.",
            "ai_role": "Lotte, a new friend you met at the park, curious about your family",
            "user_role": "a new friend who will tell Lotte about their own family",
            "opening": "Say hi and ask the learner about their family.",
            "goal": "Tell Lotte who is in your family (or who you live with) and whether you have a pet.",
            "words": ["moeder", "vader", "broer", "zus", "kind", "hond", "kat", "huis"],
            "phrases": [
                ["Ik heb een broer en een zus.", "I have a brother and a sister."],
                ["Mijn moeder heet ...", "My mother is called ..."],
                ["Ik heb een hond / geen huisdier.", "I have a dog / no pet."],
                ["Hij / zij is ... jaar.", "He / she is ... years old."],
                ["Heb jij kinderen?", "Do you have children?"],
            ],
        },
        {
            "id": "weekend",
            "title": "Het weekend",
            "title_en": "The weekend",
            "description": "A colleague asks about your plans for the weekend.",
            "ai_role": "Jeroen, a chatty colleague at the coffee machine on Friday",
            "user_role": "Jeroen's colleague, who has plans for the weekend",
            "opening": "Say hi and ask the learner what they are doing this weekend.",
            "goal": "Say what you will do this weekend and react to the weather.",
            "words": ["weekend", "weer", "zon", "strand", "park", "feest", "trein", "fiets", "vriend"],
            "phrases": [
                ["Dit weekend ga ik naar ...", "This weekend I'm going to ..."],
                ["Het weer is mooi.", "The weather is nice."],
                ["Ik ga met de trein / fiets.", "I'm going by train / bike."],
                ["Wat ga jij doen?", "What are you going to do?"],
                ["Fijn weekend!", "Have a nice weekend!"],
            ],
        },
        {
            "id": "hotel",
            "title": "In het hotel",
            "title_en": "At the hotel",
            "description": "You arrive at your hotel. Check in at the reception.",
            "ai_role": "Mevrouw de Vries, the receptionist of a small hotel in Den Haag",
            "user_role": "a guest arriving at the hotel to check in",
            "opening": "Welcome the guest and ask how you can help.",
            "goal": "Check in with your name, ask for your room key, and ask what time breakfast is.",
            "words": ["hotel", "kamer", "sleutel", "bed", "raam", "nummer", "uur", "nacht"],
            "phrases": [
                ["Ik heb een kamer gereserveerd.", "I have booked a room."],
                ["Voor twee nachten.", "For two nights."],
                ["Wat is het kamernummer?", "What is the room number?"],
                ["Hoe laat is het ontbijt?", "What time is breakfast?"],
                ["Mag ik de sleutel?", "May I have the key?"],
            ],
        },
    ],
    "A2": [
        {
            "id": "dokter",
            "title": "Bij de dokter",
            "title_en": "At the doctor's",
            "description": "You don't feel well and have an appointment with the doctor.",
            "ai_role": "Dokter Bakker, a calm and friendly family doctor in Rotterdam",
            "user_role": "a patient who feels ill and came for an appointment",
            "opening": "Greet the patient and ask what the problem is. Do NOT suggest any symptoms yourself.",
            "goal": "Explain what hurts and how long you have felt ill, then ask what you should do.",
            "words": ["dokter", "afspraak", "pijn", "koorts", "keel", "buik", "hoofd", "medicijn", "apotheek"],
            "phrases": [
                ["Ik voel me niet lekker.", "I don't feel well."],
                ["Ik heb pijn in mijn ...", "I have pain in my ..."],
                ["Sinds twee dagen heb ik koorts.", "I've had a fever for two days."],
                ["Wat moet ik doen?", "What should I do?"],
                ["Moet ik medicijnen nemen?", "Do I need to take medicine?"],
            ],
        },
        {
            "id": "kleding",
            "title": "Kleren kopen",
            "title_en": "Buying clothes",
            "description": "You need something new to wear. Get help from a shop assistant.",
            "ai_role": "Eva, a helpful shop assistant in a clothes shop in Groningen",
            "user_role": "a customer looking for a piece of clothing",
            "opening": "Greet the customer and ask if you can help. Do NOT suggest a piece of clothing yet.",
            "goal": "Say what you are looking for, with its colour and size, ask if you can try it on, and ask the price.",
            "words": ["trui", "jurk", "broek", "rok", "overhemd", "maat", "kleur", "prijs", "spiegel"],
            "phrases": [
                ["Ik zoek een trui.", "I'm looking for a sweater."],
                ["Heeft u deze in een andere maat?", "Do you have this in another size?"],
                ["Mag ik dit passen?", "May I try this on?"],
                ["Het is te groot / te klein.", "It's too big / too small."],
                ["Wat kost deze jurk?", "How much is this dress?"],
            ],
        },
        {
            "id": "treinkaartje",
            "title": "Op het station",
            "title_en": "At the train station",
            "description": "You want to travel by train and go to the ticket desk.",
            "ai_role": "Willem, an employee at the ticket desk of Utrecht Centraal",
            "user_role": "a traveller who wants to take a train",
            "opening": "Greet the traveller and ask how you can help. Do NOT mention any destination yourself.",
            "goal": "Buy a ticket to a city of your choice, ask when the train leaves and from which platform.",
            "words": ["station", "trein", "kaartje", "perron", "reis", "koffer", "prijs", "uur"],
            "phrases": [
                ["Ik wil graag een kaartje naar ...", "I would like a ticket to ..."],
                ["Enkele reis of retour?", "One way or return?"],
                ["Hoe laat vertrekt de trein?", "What time does the train leave?"],
                ["Van welk perron?", "From which platform?"],
                ["Moet ik overstappen?", "Do I have to change trains?"],
            ],
        },
        {
            "id": "vakantie",
            "title": "Mijn vakantie",
            "title_en": "My holiday",
            "description": "A friend is curious about the holiday you just came back from.",
            "ai_role": "Noor, a good friend you're having coffee with after your holiday",
            "user_role": "a friend who just got back from a holiday",
            "opening": "Say hi and ask the learner how their holiday was.",
            "goal": "Tell Noor where you went, what you did there (in the past tense) and what the weather was like.",
            "words": ["vakantie", "reis", "strand", "weer", "regen", "zomer", "vliegtuig", "eiland", "verhaal"],
            "phrases": [
                ["Ik ben naar ... geweest.", "I went to ..."],
                ["We hebben veel gezwommen.", "We swam a lot."],
                ["Het weer was prachtig.", "The weather was beautiful."],
                ["Het heeft veel geregend.", "It rained a lot."],
                ["Het was een leuke reis.", "It was a nice trip."],
            ],
        },
        {
            "id": "afspreken",
            "title": "Een afspraak maken",
            "title_en": "Making plans",
            "description": "You call a friend to plan something fun together.",
            "ai_role": "Bram, a friend who is quite busy and whose week is already partly full",
            "user_role": "a friend who calls to make plans",
            "opening": "Answer the phone and ask how they are. Let the learner suggest the plan.",
            "goal": "Suggest an activity, agree on a day and a time, and decide where you will meet.",
            "words": ["afspraak", "avond", "middag", "weekend", "film", "concert", "plein", "moment"],
            "phrases": [
                ["Heb je zin om ... te gaan?", "Do you feel like going to ...?"],
                ["Kun je zaterdag?", "Are you free on Saturday?"],
                ["Dan kan ik niet, want ...", "I can't then, because ..."],
                ["Hoe laat spreken we af?", "What time shall we meet?"],
                ["Zullen we afspreken bij ...?", "Shall we meet at ...?"],
            ],
        },
        {
            "id": "werk",
            "title": "Over je werk",
            "title_en": "Talking about work",
            "description": "At a birthday party, someone asks what you do for a living.",
            "ai_role": "Karin, a friendly guest at a Dutch birthday party",
            "user_role": "another guest at the party",
            "opening": "Say hi and ask what the learner does for work or study.",
            "goal": "Say what you do, describe a normal day and say what you like or don't like about it, using 'omdat'.",
            "words": ["baan", "beroep", "bedrijf", "collega", "baas", "kantoor", "vergadering", "cursus"],
            "phrases": [
                ["Ik werk als ...", "I work as a ..."],
                ["Ik werk bij een klein bedrijf.", "I work at a small company."],
                ["Ik vind mijn werk leuk, omdat ...", "I like my job, because ..."],
                ["Mijn collega's zijn aardig.", "My colleagues are nice."],
                ["Ik heb vaak vergaderingen.", "I often have meetings."],
            ],
        },
        {
            "id": "appartement",
            "title": "Een appartement huren",
            "title_en": "Renting an apartment",
            "description": "You're viewing an apartment you might want to rent.",
            "ai_role": "Meneer Jansen, the landlord showing the apartment in Eindhoven",
            "user_role": "someone viewing the apartment who may want to rent it",
            "opening": "Welcome the learner to the apartment and ask what they would like to know.",
            "goal": "Ask about the rent, ask about at least two parts of the apartment, and say whether you want to rent it and why.",
            "words": ["appartement", "balkon", "badkamer", "keuken", "verwarming", "buurman", "contract", "prijs"],
            "phrases": [
                ["Hoeveel is de huur per maand?", "How much is the rent per month?"],
                ["Is de verwarming inbegrepen?", "Is the heating included?"],
                ["Is er een balkon?", "Is there a balcony?"],
                ["Wanneer kan ik erin?", "When can I move in?"],
                ["Ik wil het graag huren, omdat ...", "I would like to rent it, because ..."],
            ],
        },
    ],
    "B1": [],
}


def list_scenarios(level):
    words = load_words()
    return [
        {
            **{k: s[k] for k in ("id", "title", "title_en", "description", "goal", "phrases")},
            "words": [
                {"word": w, "article": words[w]["article"], "english": words[w]["english"]}
                for w in s["words"] if w in words
            ],
        }
        for s in SCENARIOS.get(level, [])
    ]


def get_scenario(level, scenario_id):
    return next((s for s in SCENARIOS.get(level, []) if s["id"] == scenario_id), None)


# ---------- Gemini ----------
_client = None

def gemini_client():
    # Keep one client alive: a temporary Client gets garbage-collected mid-request
    # ("client has been closed").
    global _client
    if _client is None:
        from dotenv import load_dotenv
        from google import genai

        from google.genai import types

        load_dotenv()
        # v1beta: newer SDK versions default to v1, which rejects speech_config (TTS breaks).
        _client = genai.Client(
            api_key=os.getenv("GEMINI_API_KEY"),
            http_options=types.HttpOptions(api_version="v1beta"),
        )
    return _client


def _models(env, default):
    return [m.strip() for m in os.getenv(env, default).split(",") if m.strip()]


# Fastest first. Gemini is often overloaded (slow replies, "503 high demand"), so instead
# of making the learner wait, a model that is too slow or fails is skipped for the next one.
TEXT_MODELS = _models("GEMINI_MODELS", "gemini-3.1-flash-lite-preview,gemini-3.5-flash-lite,gemini-3.1-flash-lite")
TTS_MODELS = _models("GEMINI_TTS_MODELS", "gemini-3.8-flash-lite-tts,gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts")
HEDGE_AFTER = 4   # seconds; a healthy reply takes 1-3 s
TIMEOUT = 20      # seconds before a single request is given up on


def _call(model, contents, thinking, config):
    from google.genai import types

    cfg = dict(config, http_options=types.HttpOptions(timeout=TIMEOUT * 1000))
    if thinking:
        cfg["thinking_config"] = fast_thinking()
    start = time.time()
    try:
        response = gemini_client().models.generate_content(
            model=model, contents=contents, config=types.GenerateContentConfig(**cfg),
        )
        print(f"Gemini {model}: {time.time() - start:.1f}s", flush=True)
        return response
    except Exception as e:
        print(f"Gemini {model} failed after {time.time() - start:.1f}s: {str(e)[:150]}", flush=True)
        raise


def generate(contents, models=TEXT_MODELS, thinking=True, hedge_after=HEDGE_AFTER, **config):
    """generate_content that copes with an overloaded Gemini. It asks the fastest model
    first; if that fails, or hasn't answered after `hedge_after` seconds, the next model is
    asked as well (the fastest one gets two tries) and the first answer wins."""
    from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED

    queue = [models[0], *models]
    pool = ThreadPoolExecutor(max_workers=len(queue))
    pending, error = set(), None

    def launch():
        pending.add(pool.submit(_call, queue.pop(0), contents, thinking, config))

    try:
        launch()
        while pending:
            done, _ = wait(pending, timeout=hedge_after if queue else None, return_when=FIRST_COMPLETED)
            if not done:  # too slow: ask the next model in parallel
                launch()
                continue
            for f in done:
                pending.discard(f)
                try:
                    return f.result()
                except Exception as e:
                    error = e
            if queue and not pending:
                launch()
        raise error
    finally:
        pool.shutdown(wait=False, cancel_futures=True)


def fast_thinking():
    """A little thinking: as fast as none (~2 s) but noticeably more accurate corrections."""
    from google.genai import types

    return types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW)


def to_contents(history):
    """Turn [{role: 'user'|'ai', text}] into Gemini contents. Gemini needs the
    conversation to start with a user turn, so leading AI turns are dropped."""
    from google.genai import types

    contents = []
    for m in history:
        role = "user" if m["role"] == "user" else "model"
        if not contents and role == "model":
            continue
        contents.append(types.Content(role=role, parts=[types.Part(text=m["text"])]))
    return contents


def audio_content(audio, instruction):
    """A user turn holding a recorded clip ({data: base64, mime_type}) plus an instruction."""
    import base64
    from google.genai import types

    return types.Content(role="user", parts=[
        types.Part.from_bytes(data=base64.b64decode(audio["data"]), mime_type=audio["mime_type"]),
        types.Part(text=instruction),
    ])


def _system_prompt(level, scenario):
    words = ", ".join(scenario["words"])
    return (
        f"You are role-playing a conversation with a Dutch learner who speaks English.\n"
        f"YOU play: {scenario['ai_role']}.\n"
        f"The LEARNER plays: {scenario['user_role']}.\n"
        f"Situation: {scenario['description']}\n"
        f"The learner's goal (THEIR task, not yours): {scenario['goal']}\n"
        f"Your first turn: {scenario['opening']}\n"
        f"Try to naturally use some of these vocabulary words: {words}.\n\n"
        f"{LEVELS[level]}\n\n"
        "Rules:\n"
        "- Always stay in character and reply in Dutch. Never break character to chat in English.\n"
        "- Only ever speak as YOUR character. Never take over the learner's role or do their task for them: "
        "do not ask the questions they are supposed to ask or give the answers they are supposed to give. "
        "Respond the way your character naturally would and leave room for the learner to reach the goal.\n"
        "- Greet only in your very first turn. After that never greet again or restart the conversation; "
        "react to what the learner just said and move the conversation forward towards the goal.\n"
        "- Never repeat a question you already asked. If the learner did not understand, rephrase it more simply.\n"
        "- The learner must answer in Dutch. Set 'in_dutch' to false if their last message is mainly in English "
        "or any other language (a Dutch sentence with one missing word filled in with English still counts as "
        "Dutch, just with a mistake). When 'in_dutch' is false: do NOT move the conversation forward. Stay in "
        "character, kindly ask them to say it in Dutch (e.g. 'Kun je dat in het Nederlands zeggen?') and repeat "
        "your previous question in simple words. Put the Dutch way to say their message in 'better'. On your "
        "first turn set 'in_dutch' to true.\n"
        "- 'english' is a translation of your Dutch reply.\n"
        "- Feedback is about the learner's LAST message only (on your first turn: 'correct' true, other feedback "
        "fields empty). Check grammar, word order, spelling, word choice and de/het. Judge ONLY the Dutch, never the "
        "story: a correct sentence is correct even if it doesn't fit the scene yet (react to that in character in "
        "your reply instead), and 'better' must always be the learner's own sentence, fixed. If it was correct (small "
        "punctuation or capitalisation differences don't count), set 'correct' true, put a short specific "
        "compliment in English in 'why' and leave 'you_said' and 'better' empty. Otherwise set 'correct' false and:\n"
        "  'you_said' = the learner's sentence exactly as they wrote/said it,\n"
        "  'better' = the full corrected Dutch sentence (only change what is wrong),\n"
        "  'why' = one short, plain English sentence naming each change, e.g. \"Use the Dutch name of the country: "
        "Zuid-Afrika.\" or \"The verb comes second: 'Morgen ga ik', not 'Morgen ik ga'.\" Never use vague "
        "phrases like '+ word order'.\n"
        "- 'goal_reached': true once the learner has, at any point in this conversation, achieved the whole goal "
        "IN DUTCH (anything said in another language does not count). Once it is reached, wrap up naturally in "
        "character (e.g. hand over the order, say it was nice to meet them) and do not ask new questions. Never "
        "say goodbye yourself (no 'tot ziens', 'doei', 'dag', 'fijne dag') until the learner has said goodbye or "
        "thank you first: they must get the chance to say it.\n"
        "- 'said_goodbye': true only if the learner's LAST message is a goodbye and/or thank-you in Dutch (e.g. "
        "'Dank je wel!', 'Bedankt, fijne dag!', 'Tot ziens!', 'Doei!'). If they say goodbye before the goal is "
        "reached, react naturally in character and steer them back to what is still missing. If they say "
        "goodbye after the goal is reached, reply with a short, warm final goodbye.\n"
        "- If the learner's last message is TEXT, leave 'transcript' and 'pronunciation' empty.\n"
        "- If the learner's last message is AUDIO: put exactly what you heard in 'transcript' (do not fix "
        "mistakes or mispronounced words, write what was actually said) and reply to it as usual. In "
        "'pronunciation' give short friendly English feedback on the 1-2 most important pronunciation "
        "problems (e.g. the Dutch g/ch, ui, ij/ei, eu, oe, the r, long vs short vowels, word stress), naming "
        "the word and how to say it with an English comparison. Be an honest, strict teacher: judge against "
        "how a native Dutch speaker sounds, listen especially for English habits (a hard English g in 'graag', "
        "an English r, 'w' pronounced as English w, diphthongs on long vowels), and do not praise a sound "
        "that was pronounced the English way. Never invent problems: only mention sounds that really occur in words the learner said. "
        "If it truly sounded native-like, just give a short compliment. "
        "The feedback fields stay about grammar, words and de/het only."
    )


def conversation_turn(level, scenario, history, audio=None, transcript=""):
    from pydantic import BaseModel

    class Turn(BaseModel):
        dutch: str
        english: str
        in_dutch: bool
        goal_reached: bool
        said_goodbye: bool
        correct: bool
        you_said: str
        better: str
        why: str
        transcript: str
        pronunciation: str

    # The opening turn has no learner message yet, so ask the model to start the scene.
    contents = to_contents([{"role": "user", "text": "(Start the conversation now.)"}, *history])
    transcript = transcript.strip()
    if audio and transcript:
        # The learner already sees this transcript on screen, so it is the single truth:
        # listening to the clip again could hear different words than the bubble shows.
        contents.append(audio_content(audio, (
            f'(The learner answered by voice in this audio clip. Their words were transcribed as: "{transcript}". '
            "Treat exactly that text as what they said, for 'transcript', your reply and all grammar feedback. "
            "Use the audio only to judge pronunciation.)"
        )))
    elif audio:
        contents.append(audio_content(audio, "(The learner answered by voice in this audio clip.)"))

    response = generate(
        contents,
        system_instruction=_system_prompt(level, scenario),
        response_mime_type="application/json",
        response_schema=Turn,
    )
    turn = response.parsed
    if transcript:
        turn.transcript = transcript
        turn.you_said = transcript
    # The conversation only ends once the goal is reached AND the learner has said goodbye or
    # thank you in Dutch, never just because Hettie wrapped up. Whether they said goodbye is
    # checked here in code, because the model sometimes mistakes its own goodbye for theirs.
    last = transcript or (history[-1]["text"] if history and history[-1]["role"] == "user" else "")
    complete = turn.in_dutch and turn.goal_reached and says_goodbye(last)
    return {
        "dutch": turn.dutch,
        "english": turn.english,
        "feedback": _feedback(turn, first_turn=not history and not audio),
        "goal_reached": turn.goal_reached and not complete,
        "goal_complete": complete,
        "transcript": turn.transcript,
        "pronunciation": turn.pronunciation,
    }


# Dutch ways to say goodbye or thank you.
GOODBYE = re.compile(
    r"\b(dank|bedankt|dankje(wel)?|dankuwel|merci|tot (ziens|straks|later|zo|morgen|de volgende keer|kijk)"
    r"|doei|doeg|houdoe|ciao|fijne (dag|avond|middag|ochtend|week|weekend|dag nog)"
    r"|prettige (dag|avond|middag|weekend)|goedendag|dag dag)\b"
    r"|^\W*dag\b",
    re.IGNORECASE,
)


def says_goodbye(text):
    return bool(GOODBYE.search(text.strip()))


def _feedback(turn, first_turn):
    """One consistent format for corrections: what you said, the better version, and why."""
    if first_turn:
        return ""
    if not turn.in_dutch:
        lines = ["That wasn't Dutch, so Hettie is waiting for a Dutch answer."]
        if turn.better.strip():
            lines.append(f'Try saying: "{turn.better.strip()}"')
        return "\n".join(lines)
    if turn.correct or not turn.better.strip():
        return turn.why.strip() or "Goed gedaan!"
    # A "correction" that changes nothing means the sentence was fine.
    same = lambda t: re.sub(r"[^\w]", "", t.lower())
    if same(turn.better) == same(turn.you_said):
        return "Goed gedaan! Your sentence is correct."
    lines = [f'You said: "{turn.you_said.strip()}"'] if turn.you_said.strip() else []
    lines.append(f'Better: "{turn.better.strip()}"')
    if turn.why.strip():
        lines.append(f"Why: {turn.why.strip()}")
    return "\n".join(lines)


# ---------- Text to speech ----------
# Gemini voices; they all speak Dutch natively when given Dutch text.
TTS_VOICES = ["Kore", "Aoede", "Leda", "Zephyr", "Puck", "Charon", "Orus", "Fenrir"]
_tts_cache = {}


def _wav(pcm, rate=24000):
    """Gemini returns raw 16-bit mono PCM; wrap it in a WAV header so browsers can play it."""
    import struct

    return (
        b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVE"
        + b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
        + b"data" + struct.pack("<I", len(pcm)) + pcm
    )


def speak(text, voice, dutch_only=True):
    """dutch_only=False lets the voice switch language by itself (English explanations
    with Dutch examples in the tutor chat)."""
    from google.genai import types

    voice = voice if voice in TTS_VOICES else TTS_VOICES[0]
    key = (text, voice, dutch_only)
    if key not in _tts_cache:
        # Only the text itself: speech models sometimes read instructions out loud too.
        response = generate(
            text,
            models=TTS_MODELS,
            thinking=False,
            hedge_after=6,
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                language_code="nl-NL" if dutch_only else None,
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice),
                ),
            ),
        )
        part = response.candidates[0].content.parts[0].inline_data
        mime = (part.mime_type or "").lower()
        if "wav" in mime or part.data[:4] == b"RIFF":
            audio = part.data  # some TTS models already return a complete WAV file
        else:
            # raw PCM, mime_type like "audio/L16;codec=pcm;rate=24000" (sometimes with "; channels=1")
            found = re.search(r"rate=(\d+)", mime)
            audio = _wav(part.data, int(found.group(1)) if found else 24000)
        if len(_tts_cache) > 200:
            _tts_cache.clear()
        _tts_cache[key] = audio
    return _tts_cache[key]
