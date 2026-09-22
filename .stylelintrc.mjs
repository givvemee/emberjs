export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // stylelint-config-standard 의 기본값은 kebab-case 만 허용해서
    // BEM 의 block__element / block--modifier 를 전부 오류로 잡습니다.
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$',
      {
        message: (selector) =>
          `"${selector}" 는 BEM(block__element--modifier) 형식이어야 합니다`,
      },
    ],
  },
};
