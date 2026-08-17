import { many } from './db.js';

// Deliberately short. Postgres already drops English stopwords when it builds the
// tsvector; this list only exists to stop question scaffolding ("what", "does")
// from being treated as evidence when sentences are scored in answer.js.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'was', 'were', 'with', 'that', 'this', 'from', 'has', 'have', 'had',
  'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how', 'does', 'did', 'doing',
  'any', 'all', 'can', 'will', 'would', 'should', 'could', 'about', 'into', 'over', 'under',
  'there', 'their', 'they', 'them', 'its', 'our', 'your', 'his', 'her', 'been', 'being', 'you',
  'not', 'but', 'per', 'via', 'than', 'then', 'also', 'such', 'each', 'other', 'more', 'most',
  'give', 'list', 'show', 'tell', 'state', 'stated', 'please', 'summarise', 'summarize',
]);

export function queryTerms(question) {
  const raw = String(question || '').toLowerCase().match(/[a-z0-9][a-z0-9'\-.]*/g) || [];
  const terms = raw
    .map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return [...new Set(terms)];
}

// Retrieval is recall-oriented on purpose: it ORs the query terms so that a long
// natural question still matches. Precision is applied later, in answer.js, where a
// sentence has to actually contain the query terms before it can become a claim.
export async function retrieve({ firmId, mandateId, question, limit = 10 }) {
  const terms = queryTerms(question);
  if (!terms.length) return { terms, chunks: [] };

  const tsquery = terms
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .join(' | ');
  if (!tsquery) return { terms, chunks: [] };

  // firm_id and mandate_id are bound parameters supplied by the request's verified
  // membership. Nothing the model or the document says can widen this scope.
  const chunks = await many(
    `SELECT c.id, c.document_id, c.text, c.locator_kind, c.page, c.section, c.para_index, c.ordinal,
            d.filename, d.ext,
            ts_rank_cd(c.tsv, to_tsquery('english', $3)) AS score
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
      WHERE c.firm_id = $1
        AND c.mandate_id = $2
        AND c.state = 'indexed'
        AND c.tsv @@ to_tsquery('english', $3)
      ORDER BY score DESC, c.ordinal ASC
      LIMIT $4`,
    [firmId, mandateId, tsquery, limit]
  );

  return { terms, chunks };
}

export function locatorLabel(chunk) {
  if (chunk.locator_kind === 'page' && chunk.page) return `page ${chunk.page}`;
  if (chunk.section) return `section "${chunk.section}"`;
  return `part ${Number(chunk.ordinal ?? 0) + 1}`;
}
