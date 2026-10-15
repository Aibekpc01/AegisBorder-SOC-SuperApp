export type TrainingEvent = {
  external_id: string;
  time: string;
  device: string;
  account: string;
  source: string;
  type: string;
  detail: string;
  features: Record<string, unknown>;
};

export const trainingPresets = [
  {
    id: "unknown-usb",
    label: "Подключили неизвестную флешку",
    type: "usb_connected",
    detail: "Учебное подключение неизвестной флешки",
    features: { approved: false },
    repeats: 1,
  },
  {
    id: "allowed-usb",
    label: "Подключили разрешённую флешку",
    type: "usb_connected",
    detail: "Учебное подключение разрешённой флешки",
    features: { approved: true },
    repeats: 1,
  },
  {
    id: "failed-login",
    label: "Несколько раз ошиблись при входе",
    type: "login_failed",
    detail: "Учебная неудачная попытка входа",
    features: {},
    repeats: 5,
  },
  {
    id: "normal-login",
    label: "Вошли в обычное рабочее время",
    type: "login_success",
    detail: "Учебный вход в рабочее время",
    features: { local_hour: 12 },
    repeats: 1,
  },
] as const;

export function buildTrainingEvents(
  presetId: string,
  device: string,
  account: string,
  repeats: number,
  now = new Date(),
): TrainingEvent[] {
  const preset = trainingPresets.find((item) => item.id === presetId);
  if (!preset) throw new Error("Выберите учебное действие");
  if (
    !device.trim() ||
    !account.trim() ||
    device.trim().length > 80 ||
    account.trim().length > 80
  )
    throw new Error(
      "Укажите название компьютера и имя пользователя: до 80 символов",
    );
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20)
    throw new Error("Число повторений должно быть от 1 до 20");
  if (!Number.isFinite(now.getTime()))
    throw new Error("Некорректное время учебного события");
  return Array.from({ length: repeats }, (_, index) => ({
    external_id: "training-" + crypto.randomUUID(),
    time: new Date(now.getTime() + index * 1000).toISOString(),
    device: device.trim(),
    account: account.trim(),
    source: "Synthetic import",
    type: preset.type,
    detail: preset.detail,
    features: { ...preset.features },
  }));
}
