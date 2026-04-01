"""
Fuzzy Mamdani inference engine untuk prediksi risiko banjir.

Input variabel (kategorik):
  - kerawanan_banjir : "rawan" | "tidak_rawan"
  - tipe_dataran     : "rendah" | "sedang" | "tinggi"
  - kedekatan_sungai : "dekat" | "tidak_dekat"
  - tingkat_sampah   : "tinggi" | "rendah"
  - tandus_tanah     : "tandus" | "tidak_tandus"

Output (nilai 0-100, kategori): rendah | sedang | tinggi
Defuzzifikasi: Weighted Average (centroid tiap himpunan output)
"""

# ---------------------------------------------------------------------------
# Konfigurasi himpunan fuzzy input
# ---------------------------------------------------------------------------
INPUT_SETS: dict[str, dict] = {
    "kerawanan_banjir": {
        "label": "Kerawanan Banjir",
        "himpunan": {
            "rawan":       {"label": "Rawan"},
            "tidak_rawan": {"label": "Tidak Rawan"},
        },
    },
    "tipe_dataran": {
        "label": "Tipe Dataran",
        "himpunan": {
            "rendah": {"label": "Rendah"},
            "sedang": {"label": "Sedang"},
            "tinggi": {"label": "Tinggi"},
        },
    },
    "kedekatan_sungai": {
        "label": "Kedekatan Sungai / Laut",
        "himpunan": {
            "dekat":      {"label": "Dekat"},
            "tidak_dekat": {"label": "Tidak Dekat"},
        },
    },
    "tingkat_sampah": {
        "label": "Tingkat Sampah Sembarangan",
        "himpunan": {
            "tinggi": {"label": "Tinggi"},
            "rendah": {"label": "Rendah"},
        },
    },
    "tandus_tanah": {
        "label": "Kondisi Tanah",
        "himpunan": {
            "tandus":      {"label": "Tandus"},
            "tidak_tandus": {"label": "Tidak Tandus"},
        },
    },
}

# ---------------------------------------------------------------------------
# Titik tengah (centroid) himpunan output
# Rendah  : trapezoid [0,  0, 25, 45] → centroid ≈ 18
# Sedang  : triangular [25, 50, 75]   → centroid = 50
# Tinggi  : trapezoid [55, 75,100,100]→ centroid ≈ 82
# ---------------------------------------------------------------------------
Z_MIDPOINTS: dict[str, float] = {
    "rendah": 18.0,
    "sedang": 50.0,
    "tinggi": 82.0,
}

# ---------------------------------------------------------------------------
# Label pendek untuk kondisi rule
# ---------------------------------------------------------------------------
_SHORT = {
    "kerawanan_banjir": {"rawan": "Rawan", "tidak_rawan": "Tdk Rawan"},
    "tipe_dataran":     {"rendah": "Dtaran Rendah", "sedang": "Dtaran Sedang", "tinggi": "Dtaran Tinggi"},
    "kedekatan_sungai": {"dekat": "Dekat Sungai", "tidak_dekat": "Tdk Dekat Sungai"},
    "tingkat_sampah":   {"tinggi": "Sampah Tinggi", "rendah": "Sampah Rendah"},
    "tandus_tanah":     {"tandus": "Tandus", "tidak_tandus": "Tdk Tandus"},
}

def _cond_text(conditions: dict) -> str:
    return " AND ".join(_SHORT[var][val] for var, val in conditions.items())

# ---------------------------------------------------------------------------
# Rules: (antecedents_dict, output_label)
# ---------------------------------------------------------------------------
RULES: list[tuple[dict, str]] = [
    # ── TINGGI ──────────────────────────────────────────────────────────────
    ({"kerawanan_banjir": "rawan", "tipe_dataran": "rendah", "kedekatan_sungai": "dekat"}, "tinggi"),
    ({"kerawanan_banjir": "rawan", "tipe_dataran": "rendah", "tingkat_sampah": "tinggi"}, "tinggi"),
    ({"kerawanan_banjir": "rawan", "tipe_dataran": "rendah", "tandus_tanah": "tandus"}, "tinggi"),
    ({"kerawanan_banjir": "rawan", "tipe_dataran": "sedang", "kedekatan_sungai": "dekat", "tingkat_sampah": "tinggi"}, "tinggi"),
    ({"kerawanan_banjir": "rawan", "tipe_dataran": "sedang", "kedekatan_sungai": "dekat", "tandus_tanah": "tandus"}, "tinggi"),
    ({"kerawanan_banjir": "tidak_rawan", "tipe_dataran": "rendah", "kedekatan_sungai": "dekat", "tingkat_sampah": "tinggi", "tandus_tanah": "tandus"}, "tinggi"),

    # ── SEDANG ──────────────────────────────────────────────────────────────
    ({"kerawanan_banjir": "rawan", "tipe_dataran": "rendah", "kedekatan_sungai": "tidak_dekat"}, "sedang"),
    ({"kerawanan_banjir": "rawan", "tipe_dataran": "sedang", "kedekatan_sungai": "dekat"}, "sedang"),
    ({"kerawanan_banjir": "rawan", "tipe_dataran": "sedang", "tingkat_sampah": "tinggi"}, "sedang"),
    ({"kerawanan_banjir": "rawan", "tipe_dataran": "sedang", "tandus_tanah": "tandus"}, "sedang"),
    ({"kerawanan_banjir": "rawan", "tipe_dataran": "tinggi", "kedekatan_sungai": "dekat"}, "sedang"),
    ({"kerawanan_banjir": "rawan", "tipe_dataran": "tinggi", "tingkat_sampah": "tinggi", "tandus_tanah": "tandus"}, "sedang"),
    ({"kerawanan_banjir": "tidak_rawan", "tipe_dataran": "rendah", "kedekatan_sungai": "dekat"}, "sedang"),
    ({"kerawanan_banjir": "tidak_rawan", "tipe_dataran": "rendah", "tingkat_sampah": "tinggi"}, "sedang"),
    ({"kerawanan_banjir": "tidak_rawan", "tipe_dataran": "rendah", "tandus_tanah": "tandus"}, "sedang"),
    ({"kerawanan_banjir": "tidak_rawan", "tipe_dataran": "sedang", "kedekatan_sungai": "dekat", "tingkat_sampah": "tinggi"}, "sedang"),
    ({"kerawanan_banjir": "tidak_rawan", "tipe_dataran": "sedang", "kedekatan_sungai": "dekat", "tandus_tanah": "tandus"}, "sedang"),
    ({"kerawanan_banjir": "rawan", "kedekatan_sungai": "dekat", "tandus_tanah": "tandus"}, "sedang"),

    # ── RENDAH ──────────────────────────────────────────────────────────────
    ({"kerawanan_banjir": "tidak_rawan", "tipe_dataran": "tinggi"}, "rendah"),
    ({"kerawanan_banjir": "tidak_rawan", "tipe_dataran": "sedang", "kedekatan_sungai": "tidak_dekat"}, "rendah"),
    ({"kerawanan_banjir": "tidak_rawan", "tipe_dataran": "sedang", "kedekatan_sungai": "dekat", "tingkat_sampah": "rendah", "tandus_tanah": "tidak_tandus"}, "rendah"),
    ({"kerawanan_banjir": "tidak_rawan", "tipe_dataran": "rendah", "kedekatan_sungai": "tidak_dekat", "tingkat_sampah": "rendah", "tandus_tanah": "tidak_tandus"}, "rendah"),
    ({"kerawanan_banjir": "rawan", "tipe_dataran": "tinggi", "kedekatan_sungai": "tidak_dekat", "tingkat_sampah": "rendah"}, "rendah"),
]


# ---------------------------------------------------------------------------
# Inference engine
# ---------------------------------------------------------------------------
def _firing_strength(inputs: dict, conditions: dict) -> float:
    return min(
        1.0 if inputs.get(var) == val else 0.0
        for var, val in conditions.items()
    )


def predict(
    kerawanan_banjir: str,
    tipe_dataran: str,
    kedekatan_sungai: str,
    tingkat_sampah: str,
    tandus_tanah: str,
) -> dict:
    inputs = {
        "kerawanan_banjir": kerawanan_banjir,
        "tipe_dataran": tipe_dataran,
        "kedekatan_sungai": kedekatan_sungai,
        "tingkat_sampah": tingkat_sampah,
        "tandus_tanah": tandus_tanah,
    }

    # ── 1. Fuzzifikasi ───────────────────────────────────────────────────────
    fuzzifikasi = {}
    for var, cfg in INPUT_SETS.items():
        selected = inputs[var]
        fuzzifikasi[var] = {
            "label": cfg["label"],
            "nilai": selected,
            "nilai_label": cfg["himpunan"][selected]["label"],
            "himpunan": [
                {
                    "nama": info["label"],
                    "derajat": 1.0 if key == selected else 0.0,
                }
                for key, info in cfg["himpunan"].items()
            ],
        }

    # ── 2. Inferensi ─────────────────────────────────────────────────────────
    rule_results = []
    agregasi: dict[str, float] = {"rendah": 0.0, "sedang": 0.0, "tinggi": 0.0}

    for i, (conditions, output_label) in enumerate(RULES):
        alpha = _firing_strength(inputs, conditions)
        conditions_detail = [
            {
                "var_label": INPUT_SETS[var]["label"],
                "val_label": INPUT_SETS[var]["himpunan"][val]["label"],
                "mu": 1.0 if inputs.get(var) == val else 0.0,
            }
            for var, val in conditions.items()
        ]
        rule_results.append({
            "id": f"R{i + 1}",
            "kondisi": _cond_text(conditions),
            "output": output_label,
            "alpha": round(alpha, 3),
            "conditions_detail": conditions_detail,
        })
        agregasi[output_label] = max(agregasi[output_label], alpha)

    # ── 3. Defuzzifikasi (Weighted Average) ──────────────────────────────────
    formula_parts = [
        {
            "kategori": cat,
            "alpha": round(agregasi[cat], 3),
            "z": Z_MIDPOINTS[cat],
            "product": round(agregasi[cat] * Z_MIDPOINTS[cat], 3),
        }
        for cat in ("rendah", "sedang", "tinggi")
    ]

    numerator = sum(p["product"] for p in formula_parts)
    denominator = sum(p["alpha"] for p in formula_parts)
    crisp = numerator / denominator if denominator > 0 else 50.0

    # Kategori output
    if crisp < 35:
        category = "rendah"
        keterangan = "Wilayah ini memiliki risiko banjir rendah. Tetap lakukan pemantauan rutin."
    elif crisp < 65:
        category = "sedang"
        keterangan = "Wilayah ini memiliki risiko banjir sedang. Tingkatkan kesiapsiagaan dan pantau curah hujan."
    else:
        category = "tinggi"
        keterangan = "Wilayah ini memiliki risiko banjir tinggi. Segera siapkan langkah evakuasi dan peringatan dini."

    return {
        "risiko": category,
        "nilai": round(crisp, 2),
        "keterangan": keterangan,
        "detail": {
            "fuzzifikasi": fuzzifikasi,
            "inferensi": {
                "rules": rule_results,
                "agregasi": {k: round(v, 3) for k, v in agregasi.items()},
            },
            "defuzzifikasi": {
                "metode": "Weighted Average",
                "midpoints": Z_MIDPOINTS,
                "formula_parts": formula_parts,
                "numerator": round(numerator, 3),
                "denominator": round(denominator, 3),
                "nilai": round(crisp, 2),
            },
        },
    }
