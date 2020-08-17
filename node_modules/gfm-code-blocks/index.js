/*!
 * gfm-code-blocks <https://github.com/jonschlinkert/gfm-code-blocks>
 *
 * Copyright (c) 2014-2015, 2017, Jon Schlinkert.
 * Released under the MIT License.
 */

'use strict';

var gfmRegex = require('gfm-code-block-regex');

module.exports = function(str) {
  if (typeof str !== 'string') {
    throw new TypeError('expected a string');
  }

  var regex = gfmRegex();
  var blocks = [];
  var match = null;

  while ((match = regex.exec(str))) {
    blocks.push({
      start: match.index,
      end: match.index + match[1].length,
      lang: match[3],
      code: match[4],
      block: match[1]
    });
  }
  return blocks;
};
