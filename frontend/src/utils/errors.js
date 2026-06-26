const messageMap = new Map([
  ["This time slot is already booked.", "Ja existe um agendamento para este horario."],
  ["Appointment date cannot be in the past.", "A data do agendamento nao pode estar no passado."],
  ["Appointment time cannot be in the past.", "O horario do agendamento nao pode estar no passado."],
  ["Appointment time must be an available 30-minute slot.", "Escolha um horario valido de atendimento."],
  ["Barber shop context is required.", "Nao foi possivel identificar a barbearia."],
  ["Invalid credentials.", "Email ou senha invalidos."],
  ["Network Error", "Erro de conexao. Tente novamente."],
  ["Internal Server Error", "Erro interno do servidor."],
  ["Validation failed", "Verifique os dados informados."],
  ["Use YYYY-MM-DD format.", "Use uma data valida."],
  ["Availability date cannot be in the past.", "A data escolhida nao pode estar no passado."],
  ["Barber shop not found.", "Barbearia nao encontrada."],
  ["Refresh token is required.", "Sessao invalida. Entre novamente."],
  ["Invalid refresh token.", "Sessao expirada. Entre novamente."],
  ["This field is required.", "Este campo e obrigatorio."],
  ["Enter a valid date.", "Informe uma data valida."],
  ["Enter a valid time.", "Informe um horario valido."],
  ["Enter a valid email address.", "Informe um e-mail valido."],
]);

function translateText(value) {
  if (!value) return "";
  const text = String(value);
  return messageMap.get(text) || text;
}

function firstApiMessage(data) {
  if (!data) return "";

  if (typeof data === "string") return data;
  if (Array.isArray(data)) return firstApiMessage(data[0]);

  if (typeof data === "object") {
    if (data.detail) return firstApiMessage(data.detail);
    if (data.non_field_errors) return firstApiMessage(data.non_field_errors);

    const firstValue = Object.values(data)[0];
    return firstApiMessage(firstValue);
  }

  return "";
}

function looksTechnicalOrEnglish(message) {
  return /\b(this|that|field|required|invalid|error|failed|ensure|unable|not found|server|credentials)\b/i.test(
    message,
  );
}

export function getFriendlyErrorMessage(error, fallback = "Ocorreu um erro inesperado. Tente novamente.") {
  if (!error) return fallback;

  if (error.message === "Network Error" || !error.response) {
    return "Erro de conexao. Tente novamente.";
  }

  if (error.response?.status >= 500) {
    return "Erro interno do servidor.";
  }

  const apiMessage = firstApiMessage(error.response?.data);
  const translated = translateText(apiMessage || error.message);

  if (!translated) {
    return fallback;
  }

  if (apiMessage && translated === apiMessage && looksTechnicalOrEnglish(apiMessage)) {
    return fallback;
  }

  return translated;
}
