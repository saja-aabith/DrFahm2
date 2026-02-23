"""
Topic taxonomy for DrFahm question bank.

Broad categories per exam section. Designed to be refined later
as the question bank grows beyond 10k questions.

RULES:
  - topic values stored in Question.topic are the KEYS (e.g. "algebra").
  - Labels are human-readable, used in admin UI only.
  - A question's topic must be one of the keys in its section's list.
  - Topics are per-section (math, verbal, biology, etc.), NOT per-exam.
    This means the same question can be reused across exams (e.g. math
    questions shared between Qudurat and Tahsili).
  - Sections map to world_key prefixes: "math_100" → section "math".

FUTURE:
  - Add sub-topics (e.g. algebra → linear_equations, quadratics) when
    question bank exceeds ~10k per section.
  - Add topic-based worlds that pull from any difficulty band.
"""

# ── Section → ordered list of (key, label) ─────────────────────────────────

TOPIC_TAXONOMY = {
    "math": [
        ("arithmetic",          "Arithmetic"),
        ("algebra",             "Algebra"),
        ("geometry",            "Geometry"),
        ("statistics",          "Statistics & Probability"),
        ("number_patterns",     "Number Patterns & Sequences"),
        ("ratios_proportions",  "Ratios & Proportions"),
        ("percentages",         "Percentages"),
        ("equations",           "Equations & Inequalities"),
        ("fractions_decimals",  "Fractions & Decimals"),
        ("word_problems",       "Word Problems"),
        ("trigonometry",        "Trigonometry"),
        ("calculus",            "Calculus"),
    ],
    "verbal": [
        ("synonyms",               "Synonyms"),
        ("antonyms",               "Antonyms"),
        ("analogies",              "Analogies"),
        ("sentence_completion",    "Sentence Completion"),
        ("grammar",                "Grammar & Usage"),
        ("reading_comprehension",  "Reading Comprehension"),
        ("error_identification",   "Error Identification"),
        ("vocabulary",             "Vocabulary & Definitions"),
    ],
    "biology": [
        ("cells",           "Cells & Cell Biology"),
        ("genetics",        "Genetics & Heredity"),
        ("ecology",         "Ecology & Environment"),
        ("human_body",      "Human Body Systems"),
        ("classification",  "Classification & Taxonomy"),
        ("evolution",       "Evolution & Adaptation"),
        ("microbiology",    "Microbiology"),
    ],
    "chemistry": [
        ("organic",         "Organic Chemistry"),
        ("inorganic",       "Inorganic Chemistry"),
        ("reactions",       "Chemical Reactions"),
        ("periodic_table",  "Periodic Table & Elements"),
        ("solutions",       "Solutions & Mixtures"),
        ("acids_bases",     "Acids, Bases & pH"),
        ("stoichiometry",   "Stoichiometry"),
    ],
    "physics": [
        ("mechanics",       "Mechanics & Forces"),
        ("electricity",     "Electricity & Magnetism"),
        ("waves",           "Waves & Sound"),
        ("thermodynamics",  "Thermodynamics & Heat"),
        ("optics",          "Optics & Light"),
        ("nuclear",         "Nuclear & Atomic Physics"),
    ],
}

# ── Derived lookup structures ───────────────────────────────────────────────

# Flat set of all valid topic keys (for validation)
ALL_TOPIC_KEYS = set()
for section_topics in TOPIC_TAXONOMY.values():
    for key, _ in section_topics:
        ALL_TOPIC_KEYS.add(key)

# section → {key: label} for fast lookup
TOPIC_LABELS = {}
for section, topics in TOPIC_TAXONOMY.items():
    TOPIC_LABELS[section] = {key: label for key, label in topics}

# topic_key → label (flat)
TOPIC_KEY_TO_LABEL = {}
for section_topics in TOPIC_TAXONOMY.values():
    for key, label in section_topics:
        TOPIC_KEY_TO_LABEL[key] = label


def get_section_from_world_key(world_key: str) -> str:
    """
    Extracts section from world_key.
    'math_100' → 'math', 'verbal_300' → 'verbal', 'biology_150' → 'biology'
    """
    return world_key.rsplit("_", 1)[0]


def get_topics_for_world_key(world_key: str) -> list[tuple[str, str]]:
    """
    Returns [(key, label), ...] for the section that world_key belongs to.
    E.g. 'math_100' → all math topics, 'verbal_200' → all verbal topics.
    """
    section = get_section_from_world_key(world_key)
    return TOPIC_TAXONOMY.get(section, [])


def validate_topic(topic: str, world_key: str = None) -> bool:
    """
    Validates a topic key. If world_key is provided, checks that the topic
    belongs to that world's section. Otherwise just checks it's in the
    global set.
    """
    if not topic:
        return True  # null topic is always valid

    if world_key:
        section = get_section_from_world_key(world_key)
        valid_keys = {k for k, _ in TOPIC_TAXONOMY.get(section, [])}
        return topic in valid_keys

    return topic in ALL_TOPIC_KEYS


def get_api_taxonomy() -> dict:
    """
    Returns the full taxonomy in API-friendly format:
    {
        "math": [{"key": "algebra", "label": "Algebra"}, ...],
        "verbal": [...],
        ...
    }
    """
    result = {}
    for section, topics in TOPIC_TAXONOMY.items():
        result[section] = [{"key": k, "label": l} for k, l in topics]
    return result
