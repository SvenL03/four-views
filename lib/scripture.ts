// Scripture reference checking: catches invented books and impossible chapters.
// Accepts "John 3:16", "John 3:16-18", "Rom 6:3-4", "Acts 2", "1 Cor 11:23-26; 10:16".

const BOOKS: [string, number, string[]][] = [
  ["Genesis", 50, ["gen", "gn"]], ["Exodus", 40, ["exod", "ex"]], ["Leviticus", 27, ["lev"]],
  ["Numbers", 36, ["num"]], ["Deuteronomy", 34, ["deut", "dt"]], ["Joshua", 24, ["josh"]],
  ["Judges", 21, ["judg"]], ["Ruth", 4, []], ["1 Samuel", 31, ["1 sam"]], ["2 Samuel", 24, ["2 sam"]],
  ["1 Kings", 22, ["1 kgs"]], ["2 Kings", 25, ["2 kgs"]], ["1 Chronicles", 29, ["1 chr", "1 chron"]],
  ["2 Chronicles", 36, ["2 chr", "2 chron"]], ["Ezra", 10, []], ["Nehemiah", 13, ["neh"]],
  ["Esther", 10, ["esth"]], ["Job", 42, []], ["Psalms", 150, ["psalm", "ps", "pss"]],
  ["Proverbs", 31, ["prov"]], ["Ecclesiastes", 12, ["eccl", "eccles"]],
  ["Song of Songs", 8, ["song of solomon", "song"]], ["Isaiah", 66, ["isa"]], ["Jeremiah", 52, ["jer"]],
  ["Lamentations", 5, ["lam"]], ["Ezekiel", 48, ["ezek"]], ["Daniel", 12, ["dan"]], ["Hosea", 14, ["hos"]],
  ["Joel", 3, []], ["Amos", 9, []], ["Obadiah", 1, ["obad"]], ["Jonah", 4, []], ["Micah", 7, ["mic"]],
  ["Nahum", 3, ["nah"]], ["Habakkuk", 3, ["hab"]], ["Zephaniah", 3, ["zeph"]], ["Haggai", 2, ["hag"]],
  ["Zechariah", 14, ["zech"]], ["Malachi", 4, ["mal"]],
  ["Matthew", 28, ["matt", "mt"]], ["Mark", 16, ["mk"]], ["Luke", 24, ["lk"]], ["John", 21, ["jn"]],
  ["Acts", 28, []], ["Romans", 16, ["rom"]], ["1 Corinthians", 16, ["1 cor"]], ["2 Corinthians", 13, ["2 cor"]],
  ["Galatians", 6, ["gal"]], ["Ephesians", 6, ["eph"]], ["Philippians", 4, ["phil"]], ["Colossians", 4, ["col"]],
  ["1 Thessalonians", 5, ["1 thess"]], ["2 Thessalonians", 3, ["2 thess"]], ["1 Timothy", 6, ["1 tim"]],
  ["2 Timothy", 4, ["2 tim"]], ["Titus", 3, ["tit"]], ["Philemon", 1, ["phlm", "philem"]],
  ["Hebrews", 13, ["heb"]], ["James", 5, ["jas"]], ["1 Peter", 5, ["1 pet"]], ["2 Peter", 3, ["2 pet"]],
  ["1 John", 5, ["1 jn"]], ["2 John", 1, ["2 jn"]], ["3 John", 1, ["3 jn"]], ["Jude", 1, []],
  ["Revelation", 22, ["rev"]],
];

const LOOKUP = new Map<string, [string, number]>();
for (const [name, ch, abbr] of BOOKS) {
  for (const k of [name, ...abbr]) LOOKUP.set(k.toLowerCase().replace(/\./g, ""), [name, ch]);
}

/** Returns null when the reference is plausible, otherwise what is wrong with it. */
export function checkScriptureRef(ref: string): string | null {
  const parts = ref.split(/;\s*/);
  let book: [string, number] | undefined;
  for (const part of parts) {
    const m = part.trim().match(/^((?:[1-3]\s)?[A-Za-z][A-Za-z.\s]*?)\s*(\d+)(?::(\d+)(?:[-–](\d+)(?::(\d+))?)?)?(?:[-–](\d+))?\s*$/);
    if (!m) {
      // continuation like "10:16" inside "1 Cor 11:23-26; 10:16"
      const c = part.trim().match(/^(\d+)(?::\d+(?:[-–]\d+)?)?$/);
      if (c && book) {
        if (Number(c[1]) > book[1]) return `${book[0]} has ${book[1]} chapters`;
        continue;
      }
      return "cannot read reference";
    }
    const key = m[1].trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
    book = LOOKUP.get(key);
    if (!book) return `unknown book "${m[1].trim()}"`;
    const chapter = Number(m[2]);
    if (book[1] === 1 && !m[3]) continue; // "Jude 3" = verse 3 of a one-chapter book
    if (chapter < 1 || chapter > book[1]) return `${book[0]} has ${book[1]} chapters`;
    const endChapter = m[5] ? Number(m[4]) : m[6] ? Number(m[6]) : undefined;
    if (endChapter && endChapter > book[1]) return `${book[0]} has ${book[1]} chapters`;
    const verse = m[3] ? Number(m[3]) : undefined;
    if (verse !== undefined && (verse < 1 || verse > 176)) return "verse out of range";
  }
  return null;
}
