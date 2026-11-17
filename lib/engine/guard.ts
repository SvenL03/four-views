// Cheap checks before any paid call, and the normalized cache key for a query.

export type GuardResult = { ok: true; query: string; key: string } | { ok: false; message: string };

const MIN = 3;
const MAX = 160;

// Control characters (other than ordinary whitespace) and invisible/bidi characters used to hide text.
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
const INVISIBLE_RE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/;
const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|net|org|io|co|ru|xyz|info|biz|app|dev|ly|gg|me|tk|top|site|online)\b)/i;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE_RE = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const CODE_RE = /[<>{}`\\]|\$\(|=>|\b(function\s*\(|console\.|select\s+\S+\s+from|drop\s+table|insert\s+into|import\s+[\w{]|require\(|eval\()/i;
const SPAM_RE = /\b(casino|viagra|cialis|porn|onlyfans|crypto(currency)?|bitcoin|forex|buy now|click here|free money|discount|promo code|seo services|backlinks?)\b/i;
const INJECTION_RE = /\b(ignore|disregard|forget)\b.{0,30}\b(instructions?|prompts?|rules)\b|\bsystem prompt\b|\byou are now\b|\bjailbreak\b|\bdeveloper mode\b|\bact as\b/i;

// Small deny-list: slurs and plain requests to harm. Good-faith hard questions (hell, sexuality,
// abortion, suicide as a theological question) are NOT blocked here; the planner handles nuance.
const SLUR_RE = /\b(n[i1!]gg(er|a|az|ers)|k[i1]kes?|fag(got)?s?|sp[i1]cs?|ch[i1]nks?|wetbacks?|trann(y|ies)|retards?|raghead|towelhead)\b/i;
const HARM_RE = /\b(how (do i|to|can i) (make|build) (a )?(bomb|explosive|weapon)|how (do i|to|can i) (kill|poison|hurt|shoot|stab)\b|kill (all|every) (the )?\w+|(best|easiest|painless) way to (die|kill myself)|kill myself|want to die|end my life)\b/i;
const SELF_HARM_RE = /\b(kill myself|want to die|end my life|(best|easiest|painless) way to (die|kill myself)|suicide method)\b/i;

function letterShare(s: string): number {
  const chars = s.replace(/\s/g, "");
  if (!chars.length) return 0;
  const letters = chars.match(/\p{L}/gu)?.length ?? 0;
  return letters / chars.length;
}

/** Trim, collapse whitespace and reject obvious junk before spending money on a model call. */
export function guardQuery(input: unknown): GuardResult {
  if (typeof input !== "string") return { ok: false, message: "Type a topic or question to compare." };
  const raw = input.normalize("NFKC");
  if (CONTROL_RE.test(raw) || INVISIBLE_RE.test(raw)) {
    return { ok: false, message: "That text has hidden characters in it. Please type your question again." };
  }
  const query = raw.replace(/\s+/g, " ").trim();
  if (query.length < MIN) return { ok: false, message: "Type a few more words: a topic like \"baptism\" or a question." };
  if (query.length > MAX) {
    return { ok: false, message: `Please keep it under ${MAX} characters: one topic or question at a time.` };
  }
  if (SELF_HARM_RE.test(query)) {
    return {
      ok: false,
      message:
        "It sounds like you might be carrying something heavy. You don't have to carry it alone: in the US you can call or text 988 (Suicide & Crisis Lifeline) any time.",
    };
  }
  if (SLUR_RE.test(query) || HARM_RE.test(query)) {
    return { ok: false, message: "Four Views can't help with that. Try a question about Christian belief or practice." };
  }
  if (URL_RE.test(query) || EMAIL_RE.test(query) || PHONE_RE.test(query)) {
    return { ok: false, message: "Please type a topic or question rather than a link or contact details." };
  }
  if (CODE_RE.test(query)) return { ok: false, message: "Please type a topic or question in plain words." };
  const looksLikeScriptureRef = /\d+:\d+/.test(query);
  if (SPAM_RE.test(query) || /(.)\1{5,}/.test(query) || (!looksLikeScriptureRef && letterShare(query) < 0.6)) {
    return { ok: false, message: "That doesn't look like a theological question. Try something like \"the Lord's Supper\"." };
  }
  if (INJECTION_RE.test(query)) {
    return { ok: false, message: "Please type a topic or question about Christian belief or practice." };
  }
  const key = normalizeQuery(query);
  if (key.length < 2) return { ok: false, message: "Type a topic or question to compare." };
  return { ok: true, query, key };
}

const LEADING_FILLER: RegExp[] = [
  /^(please )?(can you |could you )?(tell me|explain|describe|compare|summari[sz]e)( to me)?( about| on)?\s+/,
  /^what (do|does|did|would|should) (different |various |most |the )?(christians?|churches|denominations|traditions|protestants|evangelicals|believers|theologians|the church|the bible|scripture|christianity)( \w+)? (believe|teach|think|say|hold|mean)( about| on| regarding| concerning| of)?\s+/,
  /^how (do|does|did|should) (different |various )?(christians?|churches|denominations|traditions|protestants|evangelicals|believers|the church|christianity) (view|understand|see|think about|approach|interpret|practice|handle)\s+/,
  /^what is the (christian|biblical|church'?s?|protestant|evangelical) (view|teaching|position|doctrine|understanding|perspective) (of|on|about|regarding)\s+/,
  /^(christian |biblical |theological |different |various )?(views?|perspectives?|positions?|teachings?|beliefs?|doctrines?) (of|on|about|regarding)\s+/,
  /^(what is|what are|whats|what's|who is|who are|define)\s+/,
];
const TRAILING_FILLER = /\s+(in|according to|for) (christianity|the bible|scripture|christians|the church|protestantism)$/;

/** Cache key: lowercase, no accents or punctuation, filler phrasing and leading articles removed. */
export function normalizeQuery(query: string): string {
  let s = query
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
  for (let pass = 0; pass < 2; pass++) {
    for (const re of LEADING_FILLER) s = s.replace(re, "");
    s = s.replace(TRAILING_FILLER, "");
    s = s.replace(/^(the|a|an)\s+/, "").trim();
  }
  return s;
}
