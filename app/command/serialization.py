from fastapi.encoders import jsonable_encoder


def record(row):
    return jsonable_encoder(
        {
            c.name: getattr(row, c.name)
            for c in row.__table__.columns
            if c.name not in ("password_hash", "record_hash", "prev_hash", "avatar_data")
        }
    )
