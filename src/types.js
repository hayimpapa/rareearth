// types.js — JSDoc typedefs describing the shape of the /analyze response.
// (No runtime code here; this is for editor hints and human readers.)

/**
 * @typedef {"bullish" | "bearish" | "neutral"} Sentiment
 * @typedef {"overvalued" | "undervalued" | "fairly_valued"} Valuation
 */

/**
 * @typedef {Object} CompanyAnalysis
 * @property {string} name
 * @property {string} [ticker]
 * @property {Sentiment} sentiment
 * @property {Valuation} valuation
 * @property {string[]} themes
 */

/**
 * @typedef {Object} Source
 * @property {string} title
 * @property {string} url
 * @property {string} [date]
 */

/**
 * @typedef {Object} AnalyzeResponse
 * @property {string} analysis           Free-text summary the agent wrote.
 * @property {CompanyAnalysis[]} companies
 * @property {Source[]} sources
 * @property {string} timestamp          ISO date string.
 */

export {};
