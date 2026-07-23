const STARTER_PATTERNS = [
  /^我最先看见的是[…\.。]*$/,
  /^它像是在[…\.。]*$/,
  /^周围是一片[…\.。]*$/,
  /^它正在[……\.。]*$/,
  /^画面从[……\.。]*向[……\.。]*$/,
  /^最有力量的部分在[……\.。]*$/,
  /^光从[……\.。]*照进来$/,
  /^颜色更接近[……\.。]*$/,
  /^它摸起来像[……\.。]*$/,
  /^我希望一定保留[……\.。]*$/,
  /^它对我来说像[……\.。]*$/,
  /^画面里不要出现[……\.。]*$/,
  /^I first see[.…]*$/i,
  /^It feels like it is[.…]*$/i,
  /^Around it is[.…]*$/i,
];

export function isMeaningfulUserInput(value: string): boolean {
  const content = value.trim();
  if (content.length < 2 || !/[\p{L}\p{N}]/u.test(content)) return false;
  return !STARTER_PATTERNS.some((pattern) => pattern.test(content));
}
