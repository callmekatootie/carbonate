/*!
 * gfm-code-block-regex <https://github.com/regexhq/gfm-code-block-regex>
 *
 * Copyright (c) 2014, 2017, Jon Schlinkert.
 * Released under the MIT License.
 */

'use strict';

module.exports = function() {
  return /^(([ \t]*`{3,4})([^\n]*)([\s\S]+?)(^[ \t]*\2))/gm;
};
