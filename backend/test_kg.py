"""Smoke test: the knowledge graph + blast-radius query."""
from app.kg.graph import blast_radius, build_kg, kg_export


def main():
    g = build_kg()
    exp = kg_export()
    print(f"knowledge graph: {exp['stats']['nodes']} nodes, {exp['stats']['edges']} edges")
    by_type: dict[str, int] = {}
    for n in exp["nodes"]:
        by_type[n["type"]] = by_type.get(n["type"], 0) + 1
    print("node types     :", by_type)
    print("COB-1 blast radius (1 hop):", blast_radius("COB-1", 1))
    print("COB-1 blast radius (2 hop):", blast_radius("COB-1", 2))


if __name__ == "__main__":
    main()
