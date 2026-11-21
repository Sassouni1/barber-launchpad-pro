export const MAX_SERVICE_DESCRIPTION_LENGTH = 207;

export const limitServiceDescription = (value: unknown) =>
  String(value ?? '').trim().slice(0, MAX_SERVICE_DESCRIPTION_LENGTH).trimEnd();
