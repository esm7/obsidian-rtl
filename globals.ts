export type Direction = 'ltr' | 'rtl' | 'auto';
export const RTL_CLASS = 'is-rtl';
export const AUTO_CLASS = 'is-auto';

const STRONG_DIR_REGEX = /(?:([\p{sc=Arabic}\p{sc=Hebrew}])|([\p{sc=Armenian}\p{sc=Bengali}\p{sc=Bopomofo}\p{sc=Braille}\p{sc=Buhid}\p{sc=Canadian_Aboriginal}\p{sc=Cherokee}\p{sc=Cyrillic}\p{sc=Devanagari}\p{sc=Ethiopic}\p{sc=Georgian}\p{sc=Greek}\p{sc=Gujarati}\p{sc=Gurmukhi}\p{sc=Han}\p{sc=Hangul}\p{sc=Hanunoo}\p{sc=Hiragana}\p{sc=Inherited}\p{sc=Kannada}\p{sc=Katakana}\p{sc=Khmer}\p{sc=Lao}\p{sc=Latin}\p{sc=Limbu}\p{sc=Malayalam}\p{sc=Mongolian}\p{sc=Myanmar}\p{sc=Ogham}\p{sc=Oriya}\p{sc=Runic}\p{sc=Sinhala}\p{sc=Syriac}\p{sc=Tagalog}\p{sc=Tagbanwa}\p{sc=Tamil}\p{sc=Telugu}\p{sc=Thaana}\p{sc=Thai}\p{sc=Tibetan}\p{sc=Yi}]))/u;

export const detectDirection = (s: string): Direction | null => {
	const match = s.match(STRONG_DIR_REGEX);
	if (match && match[1]) {
		return 'rtl';
	} else if (match && match[2]) {
		return 'ltr';
	}

	return null;
}
