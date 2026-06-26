const lowercaseWords = new Set(["da", "de", "do", "das", "dos", "e"]);

export function formatName(value) {
  if (!value) return "";

  return String(value)
    .trim()
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && lowercaseWords.has(word)) {
        return word;
      }

      return word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1);
    })
    .join(" ");
}

export function getDisplayName({ user, barberShop, fallback = "Barbearia" }) {
  const name = user?.username || barberShop?.name;
  return name ? formatName(name) : fallback;
}
