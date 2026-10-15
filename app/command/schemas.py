from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

RoleName = Literal["admin", "analyst", "observer", "demo", "demo_viewer"]


class LoginInput(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=256)


class UserInput(BaseModel):
    username: str = Field(min_length=3, max_length=80, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=12, max_length=128)
    role: RoleName
    full_name: str = Field(default="", max_length=160)
    department: str = Field(default="", max_length=120)
    position: str = Field(default="", max_length=120)


class ProfileInput(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}
    full_name: str = Field(default="", max_length=160)
    department: str = Field(default="", max_length=120)
    position: str = Field(default="", max_length=120)
    email: str = Field(default="", max_length=160, pattern=r"^$|^[^\s@]+@[^\s@]+\.[^\s@]+$")
    phone: str = Field(default="", max_length=40, pattern=r"^[+0-9()\s-]*$")
    bio: str = Field(default="", max_length=2000)


class AvatarInput(BaseModel):
    image_data_url: str = Field(max_length=2_900_000)


class LocationInput(BaseModel):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    accuracy: float = Field(ge=0, le=1_000_000, allow_inf_nan=False)
    observed_at: datetime

    @field_validator("observed_at")
    @classmethod
    def location_time(cls, value):
        if value.tzinfo is None:
            raise ValueError("Укажите часовой пояс измерения")
        return value


class NetworkEntry(BaseModel):
    cidr: str = Field(max_length=100)
    kind: Literal["vpn", "proxy", "tor", "hosting", "blocked", "trusted"]
    label: str = Field(min_length=1, max_length=120)
    country: str = Field(default="", max_length=80)
    city: str = Field(default="", max_length=80)

    @field_validator("cidr")
    @classmethod
    def network_range(cls, value):
        import ipaddress

        try:
            return str(ipaddress.ip_network(value, strict=False))
        except ValueError:
            raise ValueError("Введите корректный IP-адрес или диапазон CIDR") from None


class AccessPolicyInput(BaseModel):
    model_config = {"extra": "forbid"}
    block_anonymizers: bool = True
    restrict_to_trusted: bool = False
    trusted_cidrs: list[str] = Field(default_factory=list, max_length=100)
    blocked_cidrs: list[str] = Field(default_factory=list, max_length=100)
    networks: list[NetworkEntry] = Field(default_factory=list, max_length=200)

    @field_validator("trusted_cidrs", "blocked_cidrs")
    @classmethod
    def network_ranges(cls, values):
        import ipaddress

        try:
            return [str(ipaddress.ip_network(value, strict=False)) for value in values]
        except ValueError:
            raise ValueError("Некорректный IP или CIDR в списке сетей") from None


class AddressInput(BaseModel):
    ip: str = Field(max_length=100)

    @field_validator("ip")
    @classmethod
    def valid_address(cls, value):
        import ipaddress

        try:
            return str(ipaddress.ip_address(value))
        except ValueError:
            raise ValueError("Некорректный IP-адрес") from None


class UserUpdate(BaseModel):
    role: RoleName | None = None
    password: str | None = Field(default=None, min_length=12, max_length=128)


class EventInput(BaseModel):
    external_id: str = Field(min_length=1, max_length=80)
    time: datetime
    device: str = Field(min_length=1, max_length=80)
    account: str = Field(min_length=1, max_length=80)
    source: str = Field(min_length=1, max_length=80)
    type: str = Field(min_length=1, max_length=60)
    detail: str = Field(max_length=3000)
    features: dict = Field(default_factory=dict)

    @field_validator("features")
    @classmethod
    def valid_features(cls, value):
        import json

        if len(json.dumps(value, ensure_ascii=False)) > 5000:
            raise ValueError("Слишком большой набор признаков")
        for key in (
            "local_hour",
            "gap_seconds",
            "cpu",
            "processes",
            "files",
            "volume",
            "baseline",
            "connections",
            "attempts",
        ):
            if key in value and (
                isinstance(value[key], bool)
                or not isinstance(value[key], (int, float))
                or not 0 <= value[key] <= 1_000_000
            ):
                raise ValueError(f"Признак {key} должен быть неотрицательным числом")
        for key in ("restricted", "approved", "critical", "unusual", "protection_enabled"):
            if key in value and not isinstance(value[key], bool):
                raise ValueError(f"Признак {key} должен быть логическим значением")
        if "local_hour" in value and not 0 <= value["local_hour"] < 24:
            raise ValueError("Час должен находиться в диапазоне 0–23")
        return value

    @field_validator("time")
    @classmethod
    def timezone_required(cls, value):
        if value.tzinfo is None:
            raise ValueError("Укажите часовой пояс времени события")
        return value


class ScenarioInput(BaseModel):
    demo_id: int | None = None


class IncidentUpdate(BaseModel):
    status: (
        Literal["Новый", "На проверке", "Подтверждён", "Устранён", "Закрыт", "Ложное срабатывание"]
        | None
    ) = None
    assignee_id: int | None = None


class CommentInput(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class InvestigationInput(BaseModel):
    conclusion: str = Field(max_length=10000)
    checklist: list[str] = Field(max_length=10)


class RuleUpdate(BaseModel):
    enabled: bool
    threshold: int = Field(ge=1, le=1000)
    window: int = Field(ge=10, le=3600)
    risk: int = Field(ge=1, le=100)
