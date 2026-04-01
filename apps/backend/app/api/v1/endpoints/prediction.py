from fastapi import APIRouter

from app.schemas.prediction import PredictionInput, PredictionOutput
from app.services.fuzzy_service import predict

router = APIRouter()


@router.post("", response_model=PredictionOutput)
def predict_flood_risk(payload: PredictionInput) -> PredictionOutput:
    result = predict(
        kerawanan_banjir=payload.kerawanan_banjir,
        tipe_dataran=payload.tipe_dataran,
        kedekatan_sungai=payload.kedekatan_sungai,
        tingkat_sampah=payload.tingkat_sampah,
        tandus_tanah=payload.tandus_tanah,
    )
    return PredictionOutput(**result)
