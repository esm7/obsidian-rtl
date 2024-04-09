export type Direction = 'ltr' | 'rtl' | 'auto';
export const RTL_CLASS = 'is-rtl';
export const AUTO_CLASS = 'is-auto';

// Based on the Unicode Scripts section of:
// https://www.regular-expressions.info/unicode.html 
// Basically Arabic, Hebrew, Syriac and Thaana character classes are considered RTL (group 1) and all the 
// others are considered LTR.
const STRONG_DIR_REGEX = /(?:([\p{sc=Arabic}\p{sc=Hebrew}\p{sc=Syriac}\p{sc=Thaana}])|([\p{sc=Armenian}\p{sc=Bengali}\p{sc=Bopomofo}\p{sc=Braille}\p{sc=Buhid}\p{sc=Canadian_Aboriginal}\p{sc=Cherokee}\p{sc=Cyrillic}\p{sc=Devanagari}\p{sc=Ethiopic}\p{sc=Georgian}\p{sc=Greek}\p{sc=Gujarati}\p{sc=Gurmukhi}\p{sc=Han}\p{sc=Hangul}\p{sc=Hanunoo}\p{sc=Hiragana}\p{sc=Inherited}\p{sc=Kannada}\p{sc=Katakana}\p{sc=Khmer}\p{sc=Lao}\p{sc=Latin}\p{sc=Limbu}\p{sc=Malayalam}\p{sc=Mongolian}\p{sc=Myanmar}\p{sc=Ogham}\p{sc=Oriya}\p{sc=Runic}\p{sc=Sinhala}\p{sc=Tagalog}\p{sc=Tagbanwa}\p{sc=Tamil}\p{sc=Telugu}\p{sc=Thai}\p{sc=Tibetan}\p{sc=Yi}]))/u;

export const detectDirection = (s: string): Direction | null => {
	const match = s.match(STRONG_DIR_REGEX);
	if (match && match[1]) {
		return 'rtl';
	} else if (match && match[2]) {
		return 'ltr';
	}

	return null;
}

const NAMED_LINK_REGEX = /\[\[[^\]]*\|([^\]]*)\]\]/;

// Replacing so we don't get the 'x' character which is used to show a checked checkbox in 
// markdown as a LTR direction indicator.
export const removeNoneMeaningfullText = (s: string): string => {
	s = s.replace(NAMED_LINK_REGEX, '$1');
	return s.replace('- [x]', '');
}
