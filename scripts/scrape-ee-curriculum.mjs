#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "https://guide.wisc.edu";
const MAIN_URL = `${BASE_URL}/undergraduate/engineering/electrical-computer-engineering/electrical-engineering-bs/`;
const ML_DS_URL = `${MAIN_URL}electrical-engineering-machine-learning-data-science-bs/`;
const SEMI_URL = `${MAIN_URL}electrical-engineering-semiconductor-engineering-bs/`;

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#8203;|\u200B/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, " "));
}

function normCode(raw) {
  return decodeEntities(raw)
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .trim()
    .toUpperCase();
}

function pickCanonicalId(displayCodeRaw) {
  const clean = normCode(displayCodeRaw);
  const parts = clean.split("/");
  if (parts.length === 1) {
    return { canonical: clean, displayCode: clean, aliases: [] };
  }
  // Last part contains "<SUBJ> <NUM>"
  const last = parts[parts.length - 1].trim();
  const m = last.match(/^(.+?)\s+(\d+[A-Z]?)$/);
  if (!m) {
    return { canonical: clean, displayCode: clean, aliases: [] };
  }
  const num = m[2];
  const subjects = [...parts.slice(0, -1).map((s) => s.trim()), m[1].trim()];
  const allCodes = subjects.map((subj) => `${subj} ${num}`);
  const eceCode = allCodes.find((c) => c.startsWith("E C E "));
  const canonical = eceCode || allCodes[0];
  const aliases = allCodes.filter((c) => c !== canonical);
  const displayCode = `${subjects.join("/")} ${num}`;
  return { canonical, displayCode, aliases };
}

async function fetchText(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "uw-madison-ee-graph-builder/1.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
}

async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await fn(items[cur], cur);
    }
  });
  await Promise.all(workers);
  return results;
}

function extractContainer(html, id) {
  const startMarker = `<div id="${id}"`;
  const start = html.indexOf(startMarker);
  if (start === -1) return "";
  const endComment = `</div><!--end #${id}-->`;
  const endIdx = html.indexOf(endComment, start);
  if (endIdx !== -1) return html.slice(start, endIdx);
  // fallback to next container
  const rest = html.slice(start + startMarker.length);
  const next = rest.search(/<div id="[a-z0-9_]+container"/i);
  return next !== -1 ? html.slice(start, start + startMarker.length + next) : html.slice(start);
}

function extractCourseLinksFromHtml(fragment) {
  const codes = new Set();
  const re = /href="\/search\/\?P=([^"]+)"/g;
  let m;
  while ((m = re.exec(fragment))) {
    codes.add(normCode(decodeURIComponent(m[1])));
  }
  return [...codes];
}

function parseTableSections(reqHtml) {
  // Split by headings h2/h3/h4 or caption/section markers
  const sections = [];
  const headingRe = /<(h[234])[^>]*>(.*?)<\/\1>|<table[^>]*class="[^"]*sc_courselist[^"]*"[^>]*>(.*?)<\/table>/gs;
  let currentHeading = "General";
  let m;
  while ((m = headingRe.exec(reqHtml))) {
    if (m[1]) {
      currentHeading = stripTags(m[2]);
    } else if (m[3]) {
      const rows = [];
      const rowRe = /<tr[^>]*>(.*?)<\/tr>/gs;
      let rm;
      while ((rm = rowRe.exec(m[3]))) {
        const rowHtml = rm[1];
        const links = extractCourseLinksFromHtml(rowHtml);
        const text = stripTags(rowHtml);
        rows.push({ text, links, raw: rowHtml });
      }
      sections.push({ heading: currentHeading, rows });
    }
  }
  return sections;
}

function parseSamplePlan(planHtml) {
  const semesters = [];
  const tableRe = /<table[^>]*class="[^"]*sc_plangrid[^"]*"[^>]*>(.*?)<\/table>/gs;
  let tm;
  while ((tm = tableRe.exec(planHtml))) {
    const tbody = tm[1];
    const rowRe = /<tr[^>]*>(.*?)<\/tr>/gs;
    let rm;
    let yearNum = 1;
    let fallItems = [];
    let springItems = [];
    let fallTotal = 0;
    let springTotal = 0;

    function flushYear() {
      if (fallItems.length || springItems.length) {
        semesters.push({
          semester: (yearNum - 1) * 2 + 1,
          year: yearNum,
          term: "Fall",
          totalCredits: fallTotal,
          items: fallItems,
        });
        semesters.push({
          semester: (yearNum - 1) * 2 + 2,
          year: yearNum,
          term: "Spring",
          totalCredits: springTotal,
          items: springItems,
        });
        fallItems = [];
        springItems = [];
        fallTotal = 0;
        springTotal = 0;
      }
    }

    while ((rm = rowRe.exec(tbody))) {
      const fullTr = rm[0];
      const tr = rm[1];
      if (/class="plangridyear/i.test(fullTr)) {
        flushYear();
        const yText = stripTags(tr);
        if (/First/i.test(yText)) yearNum = 1;
        else if (/Second/i.test(yText)) yearNum = 2;
        else if (/Third/i.test(yText)) yearNum = 3;
        else if (/Fourth/i.test(yText)) yearNum = 4;
        else yearNum++;
        continue;
      }
      if (/class="plangridterm/i.test(fullTr)) continue;
      if (/class="plangridsum/i.test(fullTr)) {
        const nums = [...tr.matchAll(/class="hourscol"[^>]*>(.*?)<\/td>/gs)].map((x) =>
          parseInt(stripTags(x[1]), 10)
        );
        if (nums.length >= 2) {
          fallTotal = nums[0] || 0;
          springTotal = nums[1] || 0;
        }
        flushYear();
        continue;
      }
      if (/class="plangridtotal/i.test(fullTr)) continue;

      const rawCells = [...tr.matchAll(/<td([^>]*)>(.*?)<\/td>/gs)];
      const cells = [];
      for (const c of rawCells) {
        cells.push(c[2]);
        if (/colspan=["']?2/i.test(c[1])) {
          cells.push("");
        }
      }
      if (cells.length >= 4) {
        const pushOrMerge = (list, cellHtml, crHtml) => {
          const label = stripTags(cellHtml);
          const credits = stripTags(crHtml);
          if (!label) return;
          const links = extractCourseLinksFromHtml(cellHtml);
          const isOrContinuation =
            (/margin-left:\s*20px/i.test(cellHtml) || /^or\b/i.test(label)) && !credits && list.length > 0;
          if (isOrContinuation) {
            const prev = list[list.length - 1];
            prev.label = `${prev.label} ${label}`.replace(/\s+/g, " ").trim();
            prev.links = [...new Set([...prev.links, ...links])];
            prev.isElectivePlaceholder =
              prev.links.length === 0 || /Elective|Advanced Lab|Capstone|or /i.test(prev.label);
            return;
          }
          list.push({
            label,
            credits,
            links,
            isElectivePlaceholder: links.length === 0 || /Elective|Advanced Lab|Capstone/i.test(label),
          });
        };
        pushOrMerge(fallItems, cells[0], cells[1]);
        pushOrMerge(springItems, cells[2], cells[3]);
      }
    }
    flushYear();
  }
  return semesters;
}

/**
 * Parse a Ribbit getcourse.rjs XML/HTML response.
 */
function parseRibbitCourse(code, xmlText) {
  const cdataMatch = xmlText.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  const html = cdataMatch ? cdataMatch[1] : xmlText;
  if (!html || !html.includes("courseblock")) {
    return null;
  }
  const titleMatch = html.match(/<p class="courseblocktitle[^"]*">([\s\S]*?)<\/p>/);
  const creditsMatch = html.match(/<p class="courseblockcredits[^"]*">([\s\S]*?)<\/p>/);
  const descMatch = html.match(/<p class="courseblockdesc[^"]*">([\s\S]*?)<\/p>/);

  const rawTitleLine = titleMatch ? stripTags(titleMatch[1]) : code;
  // Split "E C E/COMP SCI 252 — INTRODUCTION TO COMPUTER ENGINEERING"
  const dashParts = rawTitleLine.split(/\s*[—–-]{1,2}\s+/);
  const codePart = dashParts[0] || code;
  const titlePart = dashParts.slice(1).join(" — ") || rawTitleLine;

  const creditsLabelRaw = creditsMatch ? stripTags(creditsMatch[1]) : "3 credits.";
  const crMatch = creditsLabelRaw.match(/(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)/);
  const creditsLabel = crMatch ? crMatch[1].replace(/\s+/g, "") : "3";
  const credits = parseFloat(creditsLabel.split("-")[0]) || 3;

  const description = descMatch ? stripTags(descMatch[1]) : "";

  const extras = {};
  const extraRe = /<span class="cbextra-label"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span class="cbextra-data"[^>]*>([\s\S]*?)<\/span>/g;
  let em;
  while ((em = extraRe.exec(html))) {
    const label = stripTags(em[1]).replace(/:$/, "").trim();
    extras[label] = em[2];
  }

  // Fallback for nested Learning Outcomes div
  const loMatch = html.match(/Learning Outcomes:\s*<\/strong><\/span><span class=['"]cbextra-data['"]>([\s\S]*?)<\/span><\/p>/);
  let learningOutcomes = [];
  if (loMatch) {
    const loText = loMatch[1]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/Audience:\s*Undergraduate/gi, "")
      .replace(/Audience:\s*Graduate/gi, "");
    learningOutcomes = decodeEntities(loText.replace(/<[^>]+>/g, ""))
      .split(/\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);
  }

  const reqHtml = extras["Requisites"] || "";
  const requisitesRaw = reqHtml ? stripTags(reqHtml) : "None";
  const designationsRaw = extras["Course Designation"] ? stripTags(extras["Course Designation"]) : "";
  const designations = designationsRaw
    ? designationsRaw.split(/;\s*|\n/).map((s) => s.trim()).filter(Boolean)
    : [];
  const lastTaught = extras["Last Taught"] ? stripTags(extras["Last Taught"]) : "";
  const repeatable = extras["Repeatable for Credit"] ? stripTags(extras["Repeatable for Credit"]) : "No";

  return {
    codePart: normCode(codePart),
    title: toTitleCaseSmart(titlePart),
    credits,
    creditsLabel,
    description,
    reqHtml,
    requisitesRaw,
    designations,
    lastTaught,
    repeatable,
    learningOutcomes,
  };
}

function toTitleCaseSmart(str) {
  const minor = new Set(["and", "or", "of", "the", "in", "to", "for", "with", "on", "at", "by", "a", "an"]);
  const keepUpper = new Set(["I", "II", "III", "IV", "MOS", "VLSI", "DSP", "RF", "DC", "AC", "AI", "ML", "BS", "QR"]);
  return str
    .split(/\s+/)
    .map((word, idx) => {
      if (keepUpper.has(word.toUpperCase()) && /^[IVX]+$|^(MOS|VLSI|DSP|RF|DC|AC|AI|ML)$/i.test(word)) {
        return word.toUpperCase();
      }
      const lower = word.toLowerCase();
      if (idx > 0 && minor.has(lower)) return lower;
      return lower.replace(/(^|[-/])([a-z])/g, (_, p, c) => p + c.toUpperCase());
    })
    .join(" ");
}

/**
 * Clean requisite HTML and parse into { ast, nonCourseReqs, waivers, exclusionsRaw, exclusions }.
 */
function parseRequisites(reqHtml, currentCanonicalId, aliasMap) {
  if (!reqHtml || stripTags(reqHtml).toLowerCase() === "none") {
    return {
      ast: null,
      nonCourseReqs: [],
      waivers: [],
      exclusionsRaw: "",
      exclusions: [],
      referencedCodes: [],
    };
  }

  // 1. Replace <a href="/search/?P=...">...</a> with full decoded course code token!
  let expanded = reqHtml.replace(/<a[^>]+href="\/search\/\?P=([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, pVal, inner) => {
    const targetCode = normCode(decodeURIComponent(pVal));
    // Check if inner mentions "concurrent" just in case, normally outside <a>
    return ` @@CODE[${targetCode}]@@ `;
  });

  expanded = stripTags(expanded);

  // 2. Separate exclusions ("Not open to ...")
  let reqPart = expanded;
  let exclusionsRaw = "";
  const notOpenIdx = expanded.search(/\bNot open to\b/i);
  if (notOpenIdx !== -1) {
    reqPart = expanded.slice(0, notOpenIdx).trim().replace(/[.,;]+$/, "");
    exclusionsRaw = expanded.slice(notOpenIdx).replace(/@@CODE\[([^\]]+)\]@@/g, "$1").trim();
  }

  // Extract excluded course codes
  const exclusions = [];
  if (exclusionsRaw) {
    const exWithInherited = inheritSubjectsPlain(exclusionsRaw);
    const codeRe = /\b([A-Z][A-Z &]{0,14}?)\s+(\d{3}[A-Z]?)\b/g;
    let m;
    while ((m = codeRe.exec(exWithInherited))) {
      const candidate = normCode(`${m[1]} ${m[2]}`);
      const canon = aliasMap[candidate] || candidate;
      if (!exclusions.includes(canon)) exclusions.push(canon);
    }
  }

  // 3. Remove clarifying negative sentences like "MATH 211 or MATH 213 does not fulfill the requisite."
  reqPart = reqPart.replace(/[^.;]*\bdoes not fulfill\b[^.;]*[.;]?/gi, " ");
  reqPart = reqPart.replace(/[^.;]*\bwill not fulfill\b[^.;]*[.;]?/gi, " ");
  reqPart = reqPart.replace(/@@CODE\[([^\]]+)\]@@/g, "$1");

  // 4. Extract waivers (student standing / guest / consent alternatives)
  const waivers = [];
  const waiverPatterns = [
    /(?:^|,\s*|\s+or\s+|\s*;\s*)(?:a\s+)?member of Engineering Guest Students/gi,
    /(?:^|,\s*|\s+or\s+|\s*;\s*)graduate\/prof+es+ional standing/gi,
    /(?:^|,\s*|\s+or\s+|\s*;\s*)declared in [^,.;()]+(?:Certificate|Special|Honors)[^,.;()]*/gi,
    /(?:^|,\s*|\s+or\s+|\s*;\s*)consent of instructor/gi,
    /(?:^|,\s*|\s+or\s+|\s*;\s*)instructor consent/gi,
    /(?:^|,\s*|\s+or\s+|\s*;\s*)special students?/gi,
  ];
  for (const pat of waiverPatterns) {
    reqPart = reqPart.replace(pat, (match) => {
      const cleaned = match.replace(/^[,;\s]+|^or\s+/i, "").trim();
      if (cleaned && !waivers.includes(cleaned)) waivers.push(cleaned);
      return " ";
    });
  }

  // 5. Extract placement & non-course requirements
  const nonCourseReqs = [];
  // Replace "placement into <SUBJ> <NUM>" BEFORE course matching so MATH 221 doesn't self-loop!
  reqPart = reqPart.replace(/\bplacement into\s+([A-Z][A-Z &]{1,14}?\s+\d{3}[A-Z]?)/gi, (match, target) => {
    const clean = `Placement into ${normCode(target)}`;
    if (!nonCourseReqs.includes(clean)) nonCourseReqs.push(clean);
    return ` @@NONCOURSE[${clean}]@@ `;
  });

  const nonCoursePatterns = [
    /\bSatisfied Quantitative Reasoning\s*\(?QR\)?[-\s]*A\b/gi,
    /\bSatisfied QR[-\s]*A\b/gi,
    /\bSatisfied Communications?\s*A\b/gi,
    /\b(?:Junior|Senior|Sophomore|Freshman)\s+standing(?:\s+only)?\b/gi,
    /\bdeclared in [^,.;()]+/gi,
  ];
  for (const pat of nonCoursePatterns) {
    reqPart = reqPart.replace(pat, (match) => {
      const clean = match.trim();
      if (clean && !nonCourseReqs.includes(clean)) nonCourseReqs.push(clean);
      return ` @@NONCOURSE[${clean}]@@ `;
    });
  }

  // Inherit subject prefixes for bare course numbers (e.g., "MATH 113, 114, 171")
  reqPart = inheritSubjectsPlain(reqPart);

  // Clean dangling punctuation left by stripped waivers
  reqPart = reqPart
    .replace(/\s+/g, " ")
    .replace(/\(\s*(?:or|and|,|;)\s*/gi, "(")
    .replace(/\s*(?:or|and|,|;)\s*\)/gi, ")")
    .replace(/^[\s,;.]+|[\s,;.]+$/g, "")
    .replace(/(?:,\s*|\s+)(?:or|and)\s*$/i, "")
    .trim();

  // Parse tokens into AST
  const { ast, referencedCodes } = buildAstFromText(reqPart, currentCanonicalId, aliasMap);

  return {
    ast,
    nonCourseReqs,
    waivers,
    exclusionsRaw,
    exclusions,
    referencedCodes,
  };
}

function inheritSubjectsPlain(text) {
  // Recognizes known UW subject prefixes followed by 3-digit numbers and bare 3-digit numbers after commas/"or"/"and"
  // Protect @@NONCOURSE[...]@@ tokens first
  const placeholders = [];
  let safe = text.replace(/@@NONCOURSE\[[^\]]+\]@@/g, (m) => {
    placeholders.push(m);
    return ` __NC${placeholders.length - 1}__ `;
  });

  // Match course mentions or standalone numbers in sequence
  // First normalize cross-listed mentions like "E C E/COMP SCI 252" -> canonical-ish first or full
  const subjectList = [
    "COMP SCI",
    "COM ARTS",
    "E C E",
    "E M A",
    "E P D",
    "I SY E",
    "M S & E",
    "B M E",
    "N E",
    "M E",
    "L I S",
    "INTEREGR",
    "PHYSICS",
    "MATH",
    "STAT",
    "CHEM",
    "ENGL",
    "LSC",
    "ESL",
    "OTM",
    "B M I",
    "DANCE",
  ];
  const subjRegexPart = subjectList.map((s) => s.replace(/ /g, "\\s+")).join("|");
  // Tokenize by full codes (including slash crosslists), bare numbers, and delimiters
  const fullOrBareRe = new RegExp(
    `((?:(?:${subjRegexPart})\\s*\\/\\s*)*(?:${subjRegexPart}))\\s+(\\d{3}[A-Z]?)|\\b(\\d{3}[A-Z]?)\\b`,
    "gi"
  );

  let lastSubject = null;
  let result = "";
  let lastIndex = 0;
  let m;
  while ((m = fullOrBareRe.exec(safe))) {
    result += safe.slice(lastIndex, m.index);
    const between = safe.slice(lastIndex, m.index);
    if (m[1] && m[2]) {
      const subjRaw = normCode(m[1]);
      // If crosslisted like "E C E/COMP SCI", keep full as prefix for canonicalization, but remember primary subject
      lastSubject = subjRaw.split("/")[0].trim();
      result += `${subjRaw} ${m[2].toUpperCase()}`;
    } else if (m[3]) {
      const num = m[3].toUpperCase();
      // Only inherit if preceded closely by comma, "or", "and", "/" or "("
      if (lastSubject && /(?:,|or|and|\/|\()\s*$/i.test(between) && !/standing|credit|year|hours/i.test(between)) {
        result += `${lastSubject} ${num}`;
      } else {
        result += num;
      }
    }
    lastIndex = fullOrBareRe.lastIndex;
  }
  result += safe.slice(lastIndex);

  return result.replace(/__NC(\d+)__/g, (_, i) => placeholders[Number(i)]);
}

function buildAstFromText(text, currentCanonicalId, aliasMap) {
  if (!text) return { ast: null, referencedCodes: [] };

  // Tokenize into: LPAREN, RPAREN, AND, OR, COMMA, SEMI, CONCURRENT, NONCOURSE, COURSE
  const subjectList = [
    "COMP SCI",
    "COM ARTS",
    "E C E",
    "E M A",
    "E P D",
    "I SY E",
    "M S & E",
    "B M E",
    "N E",
    "M E",
    "L I S",
    "INTEREGR",
    "PHYSICS",
    "MATH",
    "STAT",
    "CHEM",
    "ENGL",
    "LSC",
    "ESL",
    "OTM",
    "B M I",
    "DANCE",
    "HIST SCI",
  ];
  const subjRegexPart = subjectList.map((s) => s.replace(/ /g, "\\s+")).join("|");
  const tokenRe = new RegExp(
    [
      `@@NONCOURSE\\[[^\\]]+\\]@@`,
      `\\(`,
      `\\)`,
      `;`,
      `,`,
      `\\b(?:or\\s+)?concurrent\\s+enrollment(?:\\s+in)?\\b`,
      `\\b(?:and)\\b`,
      `\\b(?:or)\\b`,
      `(?:(?:${subjRegexPart})\\s*\\/\\s*)*(?:${subjRegexPart})\\s+\\d{3}[A-Z]?`,
    ].join("|"),
    "gi"
  );

  const tokens = [];
  let m;
  while ((m = tokenRe.exec(text))) {
    const val = m[0];
    if (val.startsWith("@@NONCOURSE")) {
      tokens.push({ type: "NONCOURSE", value: val });
    } else if (val === "(") {
      tokens.push({ type: "LPAREN" });
    } else if (val === ")") {
      tokens.push({ type: "RPAREN" });
    } else if (val === ";") {
      tokens.push({ type: "AND" });
    } else if (val === ",") {
      tokens.push({ type: "COMMA" });
    } else if (/concurrent/i.test(val)) {
      tokens.push({ type: "CONCURRENT", raw: val });
    } else if (/^and$/i.test(val)) {
      tokens.push({ type: "AND" });
    } else if (/^or$/i.test(val)) {
      tokens.push({ type: "OR" });
    } else {
      const { canonical } = pickCanonicalId(val);
      const resolved = aliasMap[canonical] || canonical;
      if (resolved !== currentCanonicalId) {
        tokens.push({ type: "COURSE", code: resolved });
      }
    }
  }

  // Recursive descent parser for boolean expressions with commas inheriting context operator
  let pos = 0;

  function parseExpr() {
    return parseOrOrAnd();
  }

  function parseOrOrAnd() {
    // Parse a sequence of factors separated by COMMA, AND, OR
    const items = [];
    const ops = [];

    function readItem() {
      if (pos >= tokens.length) return null;
      const t = tokens[pos];
      if (t.type === "LPAREN") {
        pos++;
        const inner = parseExpr();
        if (tokens[pos]?.type === "RPAREN") pos++;
        return inner;
      }
      if (t.type === "COURSE") {
        pos++;
        let node = { type: "course", code: t.code };
        // Check immediate "or concurrent enrollment" after a single course
        if (tokens[pos]?.type === "OR" && tokens[pos + 1]?.type === "CONCURRENT") {
          pos += 2;
          node.concurrent = true;
        } else if (tokens[pos]?.type === "CONCURRENT") {
          pos += 1;
          node.concurrent = true;
        }
        return node;
      }
      if (t.type === "NONCOURSE") {
        pos++;
        return { type: "noncourse" };
      }
      if (t.type === "CONCURRENT") {
        pos++;
        return { type: "concurrent_marker" };
      }
      return null;
    }

    while (pos < tokens.length) {
      const t = tokens[pos];
      if (t.type === "RPAREN") break;
      if (t.type === "AND" || t.type === "OR" || t.type === "COMMA") {
        // Ignore leading operators when no item has been pushed yet
        if (items.length > 0) {
          ops.push(t.type);
        }
        pos++;
        continue;
      }
      const item = readItem();
      if (!item) {
        pos++;
        continue;
      }
      if (item.type === "concurrent_marker") {
        // Apply concurrent=true to previous items in this group (e.g. "MATH 234, 376, or concurrent enrollment")
        for (const prev of items) markConcurrent(prev);
        if (ops.length >= items.length) ops.pop();
        continue;
      }
      if (item.type === "noncourse") {
        // Ignore non-course token; preserve OR semantics if it appeared at end of an OR list ("A, B, or NONCOURSE")
        if (ops.length >= items.length && ops.length > 0) {
          const popped = ops.pop();
          if (popped === "OR" && ops.length > 0 && ops[ops.length - 1] === "COMMA") {
            ops[ops.length - 1] = "OR";
          }
        }
        continue;
      }
      items.push(item);
    }

    if (items.length === 0) return null;
    if (items.length === 1) return items[0];

    // Check if there is an explicit OR or AND among ops
    const hasOr = ops.includes("OR");
    const hasAnd = ops.includes("AND");

    // If mixed AND and OR at same level (e.g., "A, B, or C, and D"):
    // Group OR-lists connected by commas first, then AND them.
    if (hasAnd && hasOr) {
      // Split by AND
      const andGroups = [];
      let cur = [items[0]];
      let curOps = [];
      for (let i = 1; i < items.length; i++) {
        const op = ops[i - 1] || "AND";
        if (op === "AND") {
          andGroups.push(collapseGroup(cur, curOps));
          cur = [items[i]];
          curOps = [];
        } else {
          cur.push(items[i]);
          curOps.push(op);
        }
      }
      andGroups.push(collapseGroup(cur, curOps));
      const clean = andGroups.filter(Boolean);
      if (clean.length === 1) return clean[0];
      return { type: "and", items: clean };
    }

    return collapseGroup(items, ops);
  }

  function collapseGroup(items, ops) {
    if (items.length === 0) return null;
    if (items.length === 1) return items[0];
    const hasOr = ops.includes("OR");
    const kind = hasOr ? "or" : "and";
    // Flatten same-type nested nodes
    const flat = [];
    for (const it of items) {
      if (it.type === kind) flat.push(...it.items);
      else flat.push(it);
    }
    // Deduplicate course leaves inside same group
    const seen = new Set();
    const deduped = [];
    for (const it of flat) {
      if (it.type === "course") {
        if (seen.has(it.code)) continue;
        seen.add(it.code);
      }
      deduped.push(it);
    }
    if (deduped.length === 1) return deduped[0];
    return { type: kind, items: deduped };
  }

  function markConcurrent(node) {
    if (!node) return;
    if (node.type === "course") node.concurrent = true;
    else if (node.items) node.items.forEach(markConcurrent);
  }

  let ast = parseExpr();
  // Clean up any leftover tokens if unbalanced parens
  ast = simplifyAst(ast);

  const referencedCodes = [];
  collectCodes(ast, referencedCodes);

  return { ast, referencedCodes };
}

function simplifyAst(node) {
  if (!node) return null;
  if (node.type === "course") return node;
  const items = (node.items || []).map(simplifyAst).filter(Boolean);
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];
  return { type: node.type, items };
}

function collectCodes(node, out) {
  if (!node) return;
  if (node.type === "course") {
    if (!out.includes(node.code)) out.push(node.code);
  } else if (node.items) {
    for (const c of node.items) collectCodes(c, out);
  }
}

function buildEdgesFromAst(targetId, ast) {
  const edgeMap = new Map();
  if (!ast) return [];

  function walk(node, inOrBranch, orGroupLabel) {
    if (!node) return;
    if (node.type === "course") {
      if (node.code === targetId) return;
      const key = `${node.code}->${targetId}`;
      const existing = edgeMap.get(key);
      const relation = node.concurrent ? "coreq_or_prereq" : "prereq";
      const logic = inOrBranch ? "alternative" : "required";
      if (!existing) {
        edgeMap.set(key, {
          id: `${node.code}__${targetId}`,
          source: node.code,
          target: targetId,
          relation,
          logic,
          ...(inOrBranch && orGroupLabel ? { groupLabel: orGroupLabel } : {}),
        });
      } else {
        // Required overrides alternative if somehow both
        if (logic === "required") existing.logic = "required";
        if (relation === "coreq_or_prereq") existing.relation = "coreq_or_prereq";
      }
      return;
    }
    if (node.type === "or") {
      const leafCodes = [];
      collectCodes(node, leafCodes);
      const label =
        leafCodes.length <= 4
          ? `1 of: ${leafCodes.join(" / ")}`
          : `1 of ${leafCodes.length} options`;
      for (const child of node.items) {
        walk(child, true, label);
      }
      return;
    }
    if (node.type === "and") {
      for (const child of node.items) {
        walk(child, inOrBranch, orGroupLabel);
      }
    }
  }

  walk(ast, false, undefined);
  return [...edgeMap.values()];
}

async function main() {
  console.log("Fetching UW-Madison EE BS program pages...");
  const [mainHtml, mlHtml, semiHtml] = await Promise.all([
    fetchText(MAIN_URL),
    fetchText(ML_DS_URL),
    fetchText(SEMI_URL),
  ]);

  const reqHtml = extractContainer(mainHtml, "requirementstextcontainer");
  const planHtml = extractContainer(mainHtml, "fouryearplantextcontainer");
  const mlReqHtml = extractContainer(mlHtml, "requirementstextcontainer");
  const semiReqHtml = extractContainer(semiHtml, "requirementstextcontainer");

  const mainSections = parseTableSections(reqHtml);
  const mlSections = parseTableSections(mlReqHtml);
  const semiSections = parseTableSections(semiReqHtml);
  const rawSamplePlan = parseSamplePlan(planHtml);

  // Build initial registry of courses and metadata tags
  const aliasMap = {};
  const metaMap = new Map(); // canonical -> metadata object

  function ensureMeta(rawCode) {
    const { canonical, displayCode, aliases } = pickCanonicalId(rawCode);
    aliasMap[canonical] = canonical;
    for (const a of aliases) aliasMap[a] = canonical;
    if (!metaMap.has(canonical)) {
      metaMap.set(canonical, {
        id: canonical,
        displayCode,
        aliases,
        categories: new Set(),
        areas: new Set(),
        isCore: false,
        isCapstone: false,
        isLab: false,
        is301to317Lab: false,
        isAdvMathAux: false,
        isProbStat: false,
        namedOptions: {},
        sampleSemesters: new Set(),
        isCurriculum: true,
      });
    }
    return metaMap.get(canonical);
  }

  // Known special lists from official Guide prose & footnotes
  const CAPSTONES = new Set(["E C E 453", "E C E 454", "E C E 455", "E C E 554"]);
  const ADV_MATH_AUX = new Set([
    "MATH 319",
    "MATH 320",
    "MATH 340",
    "MATH 341",
    "MATH 345",
    "MATH 375",
    "MATH 376",
    "E C E 334",
    "E C E 532",
  ]);
  const PROB_STAT = new Set(["STAT 311", "STAT 424", "MATH 431", "E C E 331"]);
  const LAB_301_317 = new Set([
    "E C E 303",
    "E C E 304",
    "E C E 305",
    "E C E 313",
    "E C E 315",
    "E C E 317",
  ]);
  const FOOTNOTE_EXTRAS = ["MATH 375", "MATH 376", "E M A 201", "E M A 202", "E C E 455"];

  for (const sec of mainSections) {
    const h = sec.heading.toLowerCase();
    for (const row of sec.rows) {
      for (const linkCode of row.links) {
        const meta = ensureMeta(linkCode);
        if (h.includes("mathematics")) {
          meta.categories.add("math");
        } else if (h.includes("science")) {
          meta.categories.add("science");
        } else if (h.includes("electrical engineering core")) {
          meta.categories.add("core");
          meta.isCore = true;
        } else if (h.includes("laboratory")) {
          meta.categories.add("adv_elective");
          meta.areas.add("lab");
          meta.isLab = true;
        } else if (h.includes("fields & waves")) {
          meta.categories.add("adv_elective");
          meta.areas.add("fields_waves");
        } else if (h.includes("systems & control")) {
          meta.categories.add("adv_elective");
          meta.areas.add("systems_control");
        } else if (h.includes("power & machines")) {
          meta.categories.add("adv_elective");
          meta.areas.add("power_machines");
        } else if (h.includes("communications & signal processing")) {
          meta.categories.add("adv_elective");
          meta.areas.add("comm_sp");
        } else if (h.includes("circuits & devices")) {
          meta.categories.add("adv_elective");
          meta.areas.add("circuits_devices");
        } else if (h.includes("computers & computing")) {
          meta.categories.add("adv_elective");
          meta.areas.add("computers_computing");
        } else if (h.includes("professional electives")) {
          meta.categories.add("prof_elective");
        } else if (h.includes("communication skills")) {
          meta.categories.add("comm");
        }
      }
    }
  }

  for (const code of FOOTNOTE_EXTRAS) {
    const m = ensureMeta(code);
    if (code === "E C E 455") {
      m.categories.add("adv_elective");
      m.areas.add("computers_computing");
    } else if (code.startsWith("MATH")) {
      m.categories.add("math");
    } else if (code.startsWith("E M A")) {
      m.categories.add("science");
    }
  }

  for (const code of ADV_MATH_AUX) {
    const m = ensureMeta(code);
    m.isAdvMathAux = true;
    if (!m.categories.size) m.categories.add("prof_elective");
  }
  for (const code of PROB_STAT) {
    const m = ensureMeta(code);
    m.isProbStat = true;
    m.categories.add("math");
  }
  for (const code of CAPSTONES) {
    const m = ensureMeta(code);
    m.isCapstone = true;
    m.categories.add("adv_elective");
  }
  for (const code of LAB_301_317) {
    const m = ensureMeta(code);
    m.isLab = true;
    m.is301to317Lab = true;
    m.areas.add("lab");
    m.categories.add("adv_elective");
  }

  // Named Option 1: ML & Data Science
  for (const sec of mlSections) {
    const h = sec.heading.toLowerCase();
    const role = h.includes("elective") ? "elective" : "required";
    for (const row of sec.rows) {
      for (const linkCode of row.links) {
        const m = ensureMeta(linkCode);
        if (!m.namedOptions.mlDs) m.namedOptions.mlDs = role;
        if (!m.categories.size) m.categories.add("named_option_extra");
      }
    }
  }

  // Named Option 2: Semiconductor Engineering
  for (const sec of semiSections) {
    let curRole = "required";
    for (const row of sec.rows) {
      if (/electives|complete three/i.test(row.text)) curRole = "elective";
      if (/required courses/i.test(row.text)) curRole = "required";
      for (const linkCode of row.links) {
        const m = ensureMeta(linkCode);
        if (!m.namedOptions.semiconductor) m.namedOptions.semiconductor = curRole;
        if (!m.categories.size) m.categories.add("named_option_extra");
      }
    }
  }

  // Map sample 4-year plan semesters onto courses
  const samplePlan = rawSamplePlan.map((sem) => ({
    semester: sem.semester,
    year: sem.year,
    term: sem.term,
    totalCredits: sem.totalCredits,
    items: sem.items.map((item) => {
      const mappedIds = item.links.map((l) => {
        const { canonical } = pickCanonicalId(l);
        return aliasMap[canonical] || canonical;
      });
      if (mappedIds.length === 1 && !item.isElectivePlaceholder) {
        const meta = metaMap.get(mappedIds[0]);
        if (meta) meta.sampleSemesters.add(sem.semester);
      }
      return {
        label: item.label,
        courseId: mappedIds.length === 1 && !item.isElectivePlaceholder ? mappedIds[0] : undefined,
        altCourseIds: mappedIds.length > 1 ? mappedIds : undefined,
        credits: item.credits,
        isElectivePlaceholder: item.isElectivePlaceholder,
      };
    }),
  }));

  // Fetch Ribbit course details for all known courses
  const initialCodes = [...metaMap.keys()];
  console.log(`Fetching Ribbit details for ${initialCodes.length} curriculum courses...`);
  const ribbitCache = new Map();

  async function fetchBatch(codes) {
    const missing = codes.filter((c) => !ribbitCache.has(c));
    if (!missing.length) return;
    await mapConcurrent(missing, 8, async (code) => {
      const url = `${BASE_URL}/ribbit/index.cgi?page=getcourse.rjs&code=${encodeURIComponent(code)}`;
      const xml = await fetchText(url);
      const parsed = parseRibbitCourse(code, xml);
      ribbitCache.set(code, parsed);
      // Register any newly discovered cross-list aliases from Ribbit's authoritative courseblocktitle
      if (parsed && parsed.codePart) {
        const { canonical, aliases } = pickCanonicalId(parsed.codePart);
        aliasMap[canonical] = code;
        for (const a of aliases) aliasMap[a] = code;
      }
    });
  }

  await fetchBatch(initialCodes);

  // Parse requisites pass 1 -> discover external foundational prereqs
  const externalCandidates = new Set();
  for (const code of initialCodes) {
    const r = ribbitCache.get(code);
    if (!r) continue;
    const { referencedCodes } = parseRequisites(r.reqHtml, code, aliasMap);
    for (const ref of referencedCodes) {
      const canonRef = aliasMap[ref] || ref;
      if (!metaMap.has(canonRef)) {
        externalCandidates.add(canonRef);
      }
    }
  }

  // Fetch external foundational prereqs (1 hop, plus check if they have prereqs like MATH 112/113/114)
  if (externalCandidates.size > 0) {
    console.log(`Fetching ${externalCandidates.size} external foundational prerequisite courses...`);
    await fetchBatch([...externalCandidates]);
    // 2nd hop for external prereqs (e.g., MATH 114 -> MATH 112/113, COMP SCI 220)
    const hop2 = new Set();
    for (const ext of externalCandidates) {
      const r = ribbitCache.get(ext);
      if (!r) continue;
      const { referencedCodes } = parseRequisites(r.reqHtml, ext, aliasMap);
      for (const ref of referencedCodes) {
        const canonRef = aliasMap[ref] || ref;
        if (!metaMap.has(canonRef) && !externalCandidates.has(canonRef)) {
          hop2.add(canonRef);
        }
      }
    }
    if (hop2.size > 0) {
      console.log(`Fetching ${hop2.size} second-hop external prerequisite courses...`);
      await fetchBatch([...hop2]);
      for (const h of hop2) externalCandidates.add(h);
    }
  }

  // Register external prereqs in metaMap
  for (const ext of externalCandidates) {
    if (!metaMap.has(ext) && ribbitCache.get(ext)) {
      const { canonical, displayCode, aliases } = pickCanonicalId(ext);
      aliasMap[canonical] = canonical;
      for (const a of aliases) aliasMap[a] = canonical;
      metaMap.set(canonical, {
        id: canonical,
        displayCode,
        aliases,
        categories: new Set(["external_prereq"]),
        areas: new Set(),
        isCore: false,
        isCapstone: false,
        isLab: false,
        is301to317Lab: false,
        isAdvMathAux: false,
        isProbStat: false,
        namedOptions: {},
        sampleSemesters: new Set(),
        isCurriculum: false,
      });
    }
  }

  // Build final Course[] and Edge[]
  const courses = [];
  const allEdges = [];
  const edgeSeen = new Set();
  const suspiciousReqs = [];

  for (const [id, meta] of metaMap.entries()) {
    const r = ribbitCache.get(id);
    if (!r) {
      console.warn(`WARNING: No Ribbit data for ${id}`);
      continue;
    }

    const authoritative = pickCanonicalId(r.codePart);
    const displayCode = authoritative.displayCode.includes("/") ? authoritative.displayCode : meta.displayCode;
    const aliases = [...new Set([...meta.aliases, ...authoritative.aliases])].filter((a) => a !== id);

    const parsedReq = parseRequisites(r.reqHtml, id, aliasMap);

    // Check if non-trivial requisites yielded zero course AST and zero nonCourseReqs
    if (
      r.requisitesRaw !== "None" &&
      !parsedReq.ast &&
      parsedReq.nonCourseReqs.length === 0 &&
      parsedReq.waivers.length === 0
    ) {
      suspiciousReqs.push({ id, raw: r.requisitesRaw });
    }

    // Determine primaryCategory in priority order
    const cats = [...meta.categories];
    let primaryCategory = "external_prereq";
    if (meta.isCore) primaryCategory = "core";
    else if (cats.includes("math")) primaryCategory = "math";
    else if (cats.includes("science")) primaryCategory = "science";
    else if (cats.includes("comm")) primaryCategory = "comm";
    else if (cats.includes("adv_elective")) primaryCategory = "adv_elective";
    else if (cats.includes("prof_elective")) primaryCategory = "prof_elective";
    else if (cats.includes("named_option_extra")) primaryCategory = "named_option_extra";

    const numMatch = id.match(/(\d{3})/);
    const num = numMatch ? parseInt(numMatch[1], 10) : 0;
    const is400PlusEce = id.startsWith("E C E ") && num >= 400;

    const course = {
      id,
      displayCode,
      aliases,
      title: r.title,
      credits: r.credits,
      creditsLabel: r.creditsLabel,
      description: r.description,
      requisitesRaw: r.requisitesRaw,
      prereqAst: parsedReq.ast,
      nonCourseReqs: parsedReq.nonCourseReqs,
      waivers: parsedReq.waivers,
      exclusionsRaw: parsedReq.exclusionsRaw,
      exclusions: parsedReq.exclusions,
      learningOutcomes: r.learningOutcomes,
      designations: r.designations,
      lastTaught: r.lastTaught,
      repeatable: r.repeatable,

      primaryCategory,
      categories: cats,
      areas: [...meta.areas],
      isCore: meta.isCore,
      isCapstone: meta.isCapstone,
      isLab: meta.isLab,
      is301to317Lab: meta.is301to317Lab,
      is400PlusEce,
      isAdvMathAux: meta.isAdvMathAux,
      isProbStat: meta.isProbStat,
      isExternalPrereq: !meta.isCurriculum,
      namedOptions: meta.namedOptions,
      sampleSemesters: [...meta.sampleSemesters].sort((a, b) => a - b),
    };

    courses.push(course);

    const edges = buildEdgesFromAst(id, parsedReq.ast);
    for (const edge of edges) {
      if (edge.source === edge.target) {
        throw new Error(`Self-loop detected on ${edge.source}`);
      }
      if (!metaMap.has(edge.source) || !ribbitCache.get(edge.source)) {
        // Ignore edges from missing courses outside catalog
        continue;
      }
      const k = `${edge.source}->${edge.target}`;
      if (!edgeSeen.has(k)) {
        edgeSeen.add(k);
        allEdges.push(edge);
      }
    }
  }

  courses.sort((a, b) => a.id.localeCompare(b.id));

  const dataset = {
    generatedAt: new Date().toISOString(),
    catalogYear: "2026-2027",
    sourceUrl: `${MAIN_URL}#requirementstext`,
    courses,
    edges: allEdges,
    aliasMap,
    samplePlan,
    stats: {
      totalCourses: courses.length,
      curriculumCourses: courses.filter((c) => !c.isExternalPrereq).length,
      externalPrereqs: courses.filter((c) => c.isExternalPrereq).length,
      totalEdges: allEdges.length,
    },
  };

  const outPath = path.join(process.cwd(), "src", "data", "ee-curriculum.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2));

  console.log("\n=== SCRAPE SUMMARY ===");
  console.log(`Saved to ${outPath}`);
  console.log("Stats:", dataset.stats);
  const byPrimary = {};
  for (const c of courses) byPrimary[c.primaryCategory] = (byPrimary[c.primaryCategory] || 0) + 1;
  console.log("By primaryCategory:", byPrimary);
  console.log("Core count:", courses.filter((c) => c.isCore).length);
  console.log("Capstone count:", courses.filter((c) => c.isCapstone).length);
  console.log("Sample plan semesters:", samplePlan.length);

  if (suspiciousReqs.length) {
    console.log("Suspicious requisites (0 AST & 0 nonCourseReqs):", suspiciousReqs);
  } else {
    console.log("Suspicious requisites: NONE");
  }

  console.log("\n=== KEY COURSE CHECKS ===");
  for (const checkId of [
    "E C E 222",
    "E C E 230",
    "E C E 340",
    "E C E 370",
    "E C E 453",
    "E C E 455",
    "E C E 554",
    "COMP SCI 300",
    "MATH 221",
    "E C E 532",
  ]) {
    const c = courses.find((x) => x.id === checkId);
    const inEdges = allEdges.filter((e) => e.target === checkId).map((e) => `${e.source}[${e.logic}/${e.relation}]`);
    console.log(`${checkId}:`, inEdges.join(", ") || "(none)", "| exclusions:", c?.exclusions.join(", ") || "(none)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
