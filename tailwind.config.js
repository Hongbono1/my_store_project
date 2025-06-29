// tailwind.config.js
module.exports = {
  // JIT는 Tailwind v3부터 기본이므로 mode 설정은 생략해도 됩니다.
  content: [
    './public/**/*.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  safelist: [
    // arbitrary value 패턴을 정규식으로 한 번에 허용
    {
      pattern: /^(max-h|h|w|m|p|text|bg)-\[(.+)\]$/,
      variants: ['sm', 'md', 'lg', 'xl'], // 필요에 따라 반응형 variant도 허용
    },
  ],
  theme: {
    extend: {
      // 추가로 확장할 테마 설정이 있으면 여기에...
    },
  },
  plugins: [],
}
