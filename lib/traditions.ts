// The traditions Four Views compares. Sven's pool of ten is kept as he chose it;
// descriptions are rewritten the way a thoughtful adherent would put them
// (own vocabulary, no critics' labels). Three candidates are off by default.
import type { TraditionId } from "./schema";

export interface Tradition {
  id: TraditionId;
  /** Full name an adherent would use. */
  name: string;
  /** Short label for tabs and table headers (max ~14 chars). */
  short: string;
  /** Three phrases the tradition uses of itself. */
  emphases: [string, string, string];
  /** Plain-language self-description, 1-2 sentences, adherent's voice (third person). */
  about: string;
  /** Representative US bodies and institutions. */
  bodies: string[];
  /** Where the tradition is genuinely divided. */
  diversity: string;
  /** BibleGateway version code most adherents in the US read. */
  translation: string;
  /** OKLCH hue for the tradition's accent. Spread evenly; no hue implies rank. */
  hue: number;
  /** Candidate traditions are hidden unless EXTRA_TRADITIONS=1. */
  candidate?: boolean;
}

export const TRADITIONS: Record<TraditionId, Tradition> = {
  reformed: {
    id: "reformed",
    name: "Reformed",
    short: "Reformed",
    emphases: ["Sovereign grace", "Covenant theology", "Confessional"],
    about:
      "Christians who read Scripture through the covenants God makes and keeps, and who confess that salvation from first to last is God's gracious work in Christ, as summarized in the Reformation confessions.",
    bodies: [
      "Presbyterian Church in America (PCA)",
      "Orthodox Presbyterian Church (OPC)",
      "Christian Reformed Church",
      "Reformed Baptist churches (1689 Confession)",
    ],
    diversity:
      "Presbyterian and Continental Reformed churches baptize infants; Reformed Baptists, who share much of the same theology of grace, baptize believers only.",
    translation: "ESV",
    hue: 250,
  },
  arminian: {
    id: "arminian",
    name: "Wesleyan-Arminian",
    short: "Wesleyan",
    emphases: ["Prevenient grace", "Christ died for all", "Holiness of heart and life"],
    about:
      "Christians who teach that God's grace goes before every person, enabling a real response to the gospel, and who press on toward holiness, love made perfect, in the line of the Wesleys.",
    bodies: [
      "Church of the Nazarene",
      "The Wesleyan Church",
      "Free Methodist Church",
      "Global Methodist Church",
      "Free Will Baptists (Arminian Baptists)",
    ],
    diversity:
      "Methodist and Nazarene churches baptize infants and believers; Free Will Baptists and many Arminian evangelicals baptize believers only.",
    translation: "NIV",
    hue: 30,
  },
  fundamentalist: {
    id: "fundamentalist",
    name: "Independent Fundamentalist",
    short: "Fundamentalist",
    emphases: ["The fundamentals of the faith", "Inerrant Word", "Biblical separation"],
    about:
      "Bible-believing Christians who hold the historic fundamentals (an inerrant Bible, the virgin birth, substitutionary atonement, bodily resurrection, Christ's return) and who separate from ministries that deny them.",
    bodies: [
      "General Association of Regular Baptist Churches (GARBC)",
      "IFCA International",
      "Foundations Baptist Fellowship International",
      "Independent Baptist churches",
    ],
    diversity:
      "Independent Baptists and other fundamentalists differ on Bible versions (KJV-only or not), on how strictly to separate, and on some end-times details.",
    translation: "KJV",
    hue: 0,
  },
  conservative_evangelical: {
    id: "conservative_evangelical",
    name: "Conservative Evangelical",
    short: "Evangelical",
    emphases: ["Gospel-centered", "Biblical authority", "Great Commission"],
    about:
      "Christians who center everything on the gospel of Christ crucified and risen, trust the Bible as God's authoritative Word, call people to personal faith, and make evangelism and missions central.",
    bodies: [
      "Southern Baptist Convention",
      "Evangelical Free Church of America",
      "Many non-denominational churches",
      "National Association of Evangelicals",
    ],
    diversity:
      "A broad coalition: Calvinists and non-Calvinists, cessationists and continuationists, complementarians and egalitarians all claim the name.",
    translation: "CSB",
    hue: 70,
  },
  progressive_evangelical: {
    id: "progressive_evangelical",
    name: "Progressive Evangelical",
    short: "Progressive Ev.",
    emphases: ["Kingdom of God", "Whole-life discipleship", "Justice and mercy"],
    about:
      "Evangelicals who keep the gospel and Scripture at the center while stressing that the kingdom Jesus announced reaches the poor, the oppressed and all of creation now, not only after death.",
    bodies: [
      "Sojourners",
      "Christians for Social Action",
      "Red Letter Christians",
      "Christians for Biblical Equality",
    ],
    diversity:
      "Some in this stream remain fully within evangelical doctrinal statements; others have moved toward mainline positions on some questions, so its answers vary more than most.",
    translation: "NIV",
    hue: 170,
  },
  mainline_liberal: {
    id: "mainline_liberal",
    name: "Mainline Protestant",
    short: "Mainline",
    emphases: ["Reason and tradition with Scripture", "Inclusive welcome", "Faith that does justice"],
    about:
      "The historic Protestant denominations that read Scripture with the tools of modern scholarship, keep their confessional and liturgical inheritance, and stress God's welcome to all and the church's work for justice.",
    bodies: [
      "Presbyterian Church (U.S.A.)",
      "The Episcopal Church",
      "United Methodist Church",
      "United Church of Christ",
      "Evangelical Lutheran Church in America",
    ],
    diversity:
      "Mainline churches carry different confessional roots (Presbyterian, Anglican, Methodist, Lutheran) and range from theologically traditional to liberal in the same denomination.",
    translation: "NRSVUE",
    hue: 290,
  },
  charismatic: {
    id: "charismatic",
    name: "Pentecostal-Charismatic",
    short: "Pentecostal",
    emphases: ["Baptism in the Holy Spirit", "Gifts for today", "Full gospel"],
    about:
      "Christians who expect the Holy Spirit to work today as in the book of Acts: empowering believers for witness, giving every spiritual gift, and healing, as part of the full gospel of Jesus the Savior, Healer, Baptizer and coming King.",
    bodies: [
      "Assemblies of God",
      "International Church of the Foursquare Gospel",
      "Church of God (Cleveland, TN)",
      "Church of God in Christ",
      "Charismatic congregations across denominations",
    ],
    diversity:
      "Classical Pentecostals teach tongues as the initial evidence of Spirit baptism; many charismatics and \"Third Wave\" believers do not.",
    translation: "NIV",
    hue: 100,
  },
  word_of_faith: {
    id: "word_of_faith",
    name: "Word of Faith",
    short: "Word of Faith",
    emphases: ["Faith in God's Word", "The believer's authority", "Covenant blessing"],
    about:
      "Charismatic Christians who teach that believers should take God at His Word, speak in agreement with His promises, and receive by faith what Christ's redemption provides, including healing and provision.",
    bodies: [
      "Rhema Bible Church and Rhema Bible Training College",
      "Kenneth Copeland Ministries",
      "Faith-teaching charismatic churches",
    ],
    diversity:
      "Teachers in this movement differ on how far material prosperity is promised and on some christological statements that critics single out.",
    translation: "NKJV",
    hue: 140,
  },
  dispensationalist: {
    id: "dispensationalist",
    name: "Dispensationalist",
    short: "Dispensational",
    emphases: ["Literal interpretation", "Israel and the church", "Blessed hope"],
    about:
      "Bible-teaching Christians who read Scripture with a consistently literal method, see distinct stewardships (dispensations) in God's dealings, keep Israel and the church distinct, and look for Christ's return for His church.",
    bodies: [
      "Dallas Theological Seminary",
      "The Master's Seminary",
      "Moody Bible Institute",
      "Many Bible churches and independent Baptist churches",
    ],
    diversity:
      "Classic, revised and progressive dispensationalists differ on how distinct Israel and the church are and on how far Christ's kingdom has already begun.",
    translation: "NASB",
    hue: 210,
  },
  open_theist: {
    id: "open_theist",
    name: "Open Theism",
    short: "Open Theism",
    emphases: ["A relational God", "A partly open future", "Love that risks"],
    about:
      "Evangelical Arminians who hold that God knows all that can be known, but that the future free choices of creatures are not yet settled, so God genuinely responds to prayer and to people in time.",
    bodies: [
      "ReKnew (Greg Boyd)",
      "Woodland Hills Church",
      "Scholars in evangelical and Wesleyan schools",
    ],
    diversity:
      "Open theists differ on whether the future is unknowable in principle or whether God chooses not to settle it, and on how much God has predetermined.",
    translation: "NIV",
    hue: 330,
  },
  lutheran: {
    id: "lutheran",
    name: "Confessional Lutheran",
    short: "Lutheran",
    emphases: ["Law and gospel", "Means of grace", "Book of Concord"],
    about:
      "Christians who confess the Book of Concord: justification by grace through faith for Christ's sake, delivered through the Word and the sacraments as God's means of grace.",
    bodies: [
      "Lutheran Church-Missouri Synod",
      "Wisconsin Evangelical Lutheran Synod",
      "North American Lutheran Church",
    ],
    diversity:
      "Confessional synods and the ELCA share the Lutheran confessions but differ on how binding they are and on several ethical questions.",
    translation: "ESV",
    hue: 50,
    candidate: true,
  },
  roman_catholic: {
    id: "roman_catholic",
    name: "Roman Catholic",
    short: "Catholic",
    emphases: ["Scripture and Tradition", "Sacramental life", "Communion with Rome"],
    about:
      "The Church in communion with the Bishop of Rome, which receives Scripture and Sacred Tradition together as the one deposit of faith, taught by the Magisterium and lived in the seven sacraments.",
    bodies: ["United States Conference of Catholic Bishops", "Catholic dioceses and parishes"],
    diversity:
      "Settled dogma is binding; on prudential and pastoral questions Catholic theologians and bishops range widely.",
    translation: "NABRE",
    hue: 10,
    candidate: true,
  },
  eastern_orthodox: {
    id: "eastern_orthodox",
    name: "Eastern Orthodox",
    short: "Orthodox",
    emphases: ["Holy Tradition", "Theosis", "Divine Liturgy"],
    about:
      "The communion of Eastern churches that holds the faith of the seven ecumenical councils, receives Scripture within Holy Tradition, and understands salvation as union with God (theosis).",
    bodies: [
      "Greek Orthodox Archdiocese of America",
      "Orthodox Church in America",
      "Antiochian Orthodox Christian Archdiocese",
    ],
    diversity:
      "Orthodox jurisdictions share doctrine and worship; they differ on calendar, language and some pastoral practice.",
    translation: "NKJV",
    hue: 190,
    candidate: true,
  },
};

export function activeTraditions(): Tradition[] {
  const extra = process.env.EXTRA_TRADITIONS === "1";
  return Object.values(TRADITIONS).filter((t) => extra || !t.candidate);
}

export function tradition(id: TraditionId): Tradition {
  return TRADITIONS[id];
}
