import { parse as parseTest } from './test.js';
import { parse as parseBuild } from './build.js';
import { parse as parseLogs } from './logs.js';
import { parse as parseHttp } from './http.js';
import { parse as parseGeneric } from './generic.js';

export const parserRegistry = Object.freeze({
  test: parseTest,
  build: parseBuild,
  logs: parseLogs,
  http: parseHttp,
  generic: parseGeneric,
});

export const parserFamilies = Object.freeze(Object.keys(parserRegistry));

export function getParser(family, registry = parserRegistry) {
  const parser = registry[family];
  if (typeof parser !== 'function') throw new TypeError(`unknown parser family: ${family}`);
  return parser;
}

export function hasParser(family) {
  return Object.hasOwn(parserRegistry, family);
}
