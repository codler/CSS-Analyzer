/*! CSS Analyzer - v1.0.0 - 2013-04-24 - Utility for CSS.
* https://github.com/codler/CSS-Analyzer
* Copyright (c) 2013 Han Lin Yap http://yap.nu; MIT license */
(function(){
	var styleSheets = document.styleSheets;
	var cacheFindDefinedSelectorsKey = [];
	var cacheFindDefinedSelectors = [];
	var reSelectorTag = /(^|\s)(?:\w+)/g;
	var reSelectorClass = /\.[\w\d_-]+/g;
	var reSelectorId = /#[\w\d_-]+/g;

	var self = CSSAnalyzer = {
		specificity: function(selector) {
			var match = selector.match(reSelectorTag);
			var tagCount = match ? match.length : 0;

			match = selector.match(reSelectorClass);
			var classCount = match ? match.length : 0;

			match = selector.match(reSelectorId);
			var idCount = match ? match.length : 0;

			return tagCount + 10 * classCount + 100 * idCount;
		},

		/**
		 * Highest specificity at end
		 */
		sortSpecificity: function(a, b) {
			if (a.specificity < b.specificity) {
				 return -1; 
			} else if(a.specificity > b.specificity) {
				 return 1;  
			} else {
				 return 0;   
			}
		},

		each: function(obj, callback) {
			for (var key in obj) {
				if (obj.hasOwnProperty(key)) {
					callback.call(obj, key, obj[key]);
				}
			}
		},

		indexOf: function(array, item) {
			if (array == null) return -1;
    		var i = 0, l = array.length;
			for (; i < l; i++) if (array[i] === item) return i;
    		return -1;
		},

		trim: function(text) {
			return (text == null) ? '' : ''.trim.call(text);
		},

		/**
		 * @param text string
		 * @return string
		 */
		clean: function(text) {
			if (typeof text !== 'string') return '';

			// strip multiline comment
			text = text.replace(/\/\*((?:[^\*]|\*[^\/])*)\*\//g, '');

			// remove newline
			text = text.replace(/\n/g, '');
			text = text.replace(/\r/g, '');

			// remove @import - Future TODO read if css was imported and parse it.
			text = text.replace(/\@import[^;]*;/g, '');

			return text;
		},

		textToObj: function(text) {
			text = self.clean(text);
			var block = text.split(/({[^{}]*})/);

			// fixes recursive block at end
			if (block[block.length - 1].indexOf('}') == -1) {
				block.pop();
			}
			var objCss = [];
			var recusiveBlock = false;
			var t;
			var tt = 0;
			var ttt;
			var i = 0;
			while (i < block.length) {
				if (i % 2 === 0) {
					var selector = self.trim(block[i]);
					if (recusiveBlock) {
						if (selector.indexOf('}') != -1) {
							selector = selector.substr(1);
							block[i] = selector;

							ttt = block.splice(tt, i - tt);
							ttt.shift();
							ttt.unshift(t[1]);
							objCss[objCss.length - 1].attributes = self.textToObj(ttt.join(''));
							recusiveBlock = false;
							i = tt;
							continue;
						}
					} else {

						if (selector.indexOf('{') != -1) {
							t = selector.split('{');
							selector = self.trim(t[0]);
							recusiveBlock = true;
							tt = i;
						}
						if (selector !== "") {
							objCss.push({
								'selector': selector
							});
						}
					}
				} else {
					if (!recusiveBlock) {
						objCss[objCss.length - 1].attributes = self.textAttrToObj(block[i].substr(1, block[i].length - 2));
					}
				}
				i++;
			}
			return objCss;
		},

		textAttrToObj: function(text) {
			text = self.clean(text);
			if (!text) return {};

			// Data URI fix
			var attribute;
			text = text.replace(/url\(([^)]+)\)/g, function (url) {
				return url.replace(/;/g, '[CSSAnalyzer]');
			});
			attribute = text.split(/(:[^;]*;?)/);

			attribute.pop();
			var objAttribute = {};
			for(var i = 0, l = attribute.length; i < l; i++) {
				if (i % 2 == 1) {
					var property = self.trim(attribute[i - 1]);
					var value = attribute[i];
					objAttribute[property] = self.trim(value.substr(1).replace(';', '').replace(/url\(([^)]+)\)/g, function (url) {
						return url.replace(/\[CSSAnalyzer\]/g, ';');
					}));
				}
			}
			return objAttribute;
		},

		/**
		 * @param obj Array
		 */
		objToText: function(obj, prettyfy, indentLevel) {
			var text = '';
			prettyfy = prettyfy || false;
			indentLevel = indentLevel || 1; 
			obj.forEach(function(block) {
				if (prettyfy) text += Array(indentLevel).join('  ');
				text += block.selector + '{';
				if (Array.isArray(block.attributes)) {
					if (prettyfy) text += '\r\n' + Array(indentLevel).join('  ');
					text += self.objToText(block.attributes, prettyfy, indentLevel+1);
				} else {
					self.each(block.attributes, function(property, value) {
						if (prettyfy) text += '\r\n' + Array(indentLevel + 1).join('  ');
						text += property + ':' + value + ';';
					});
					if (prettyfy) text += '\r\n' + Array(indentLevel).join('  ');
				}
				text += '}';
				if (prettyfy) text += '\r\n';
			});
			return text;
		},

		objToTextAttr: function(obj, prettyfy, indentLevel) {
			var text = '';
			prettyfy = prettyfy || false;
			indentLevel = indentLevel || 1; 
			self.each(obj, function(property, value) {
				if (prettyfy) text += '\r\n' + Array(indentLevel + 1).join('  ');
				text += property + ':' + value + ';';
			});
			return text;
		},

		/**
		 * @param element DOM element
		 * TODO: Should get all raw css text like css3finalize and replace stylesheets?
		 * TODO: Handle media queries
		 * TODO: Handle external stylesheets, they return null
		 * TODO: Handle scope (document, iframe)
		 * @return [{selector:string, specificity:int}] order by specificity asc
		 */
		findDefinedSelectors: function(element) {
			var i;
			// Check if exists in cache
			if ((i = cacheFindDefinedSelectorsKey.indexOf(element)) !== -1) {
				// slice(0) is for "pass-by-value"
				return cacheFindDefinedSelectors[i].slice(0);
			}
			var selectors = [];
			// Loop through all styles and selectors
			for (var x = 0, ssl = styleSheets.length; x < ssl; x++) {
				var rules = styleSheets[x].cssRules;
				if (rules) {
					for (var i = 0, rl = rules.length; i < rl; i++) {
						// TODO: document why try-catch is here
						try {
							// Check if selector match element
							if (self.indexOf(document.querySelectorAll(rules[i].selectorText), element) !== -1) {
								selectors.push({
									selector: rules[i].selectorText
									,specificity: self.specificity(rules[i].selectorText)
								});
							}
						} catch (e) {}
					}
				}
			}

			selectors.sort(self.sortSpecificity);

			// Save to cache
			cacheFindDefinedSelectorsKey.push(element);
			cacheFindDefinedSelectors.push(selectors);

			return selectors.slice(0);
		}
	}
})();