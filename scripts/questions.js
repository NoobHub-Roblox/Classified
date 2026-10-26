const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const TOTAL = 7;

export function makeQuestion(level) {
  let a, b, c;
  switch (level) {
    case 0: a = r(2, 12); b = r(2, 9); return { text: `${a} + ${b} = ?`, answer: a + b };
    case 1: a = r(15, 40); b = r(3, 14); return { text: `${a} − ${b} = ?`, answer: a - b };
    case 2: a = r(2, 9); b = r(2, 9); return { text: `${a} × ${b} = ?`, answer: a * b };
    case 3: b = r(2, 9); c = r(2, 9); return { text: `${b * c} ÷ ${b} = ?`, answer: c };
    case 4: a = r(3, 9); b = r(3, 9); c = r(2, 20); return { text: `${a} × ${b} + ${c} = ?`, answer: a * b + c };
    case 5: a = r(3, 15); b = r(3, 15); c = r(2, 9); return { text: `(${a} + ${b}) × ${c} = ?`, answer: (a + b) * c };
    default: a = r(6, 12); b = r(6, 12); c = r(5, 40); return { text: `${a} × ${b} − ${c} = ?`, answer: a * b - c };
  }
}

// The seventh sheet ends with an intentional, scripted impossible question.
export function buildSheet(level) {
  const count = level >= 6 ? 2 : 3;
  const sheet = [];
  for (let i = 0; i < count; i++) sheet.push(makeQuestion(level));
  if (level >= 6) sheet.push({ text: '7 ÷ 0 = ?', answer: null, scripted: true });
  return sheet;
}
