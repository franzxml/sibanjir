from typing import Any, Literal
from pydantic import BaseModel


class PredictionInput(BaseModel):
    kerawanan_banjir: Literal["rawan", "tidak_rawan"]
    tipe_dataran: Literal["rendah", "sedang", "tinggi"]
    kedekatan_sungai: Literal["dekat", "tidak_dekat"]
    tingkat_sampah: Literal["tinggi", "rendah"]
    tandus_tanah: Literal["tandus", "tidak_tandus"]


class PredictionOutput(BaseModel):
    risiko: Literal["rendah", "sedang", "tinggi"]
    nilai: float
    keterangan: str
    detail: dict[str, Any]
