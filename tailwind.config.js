// tailwind.config.js
module.exports = {
  mode: 'jit',
  content: [
    './public/**/*.html',
    './public/**/*.js'
  ],
  safelist: [
    // 동적으로 생성하는 클래스(ex. max-h-[1080px])가 있다면
    'max-h-[1080px]',
  ],
  theme: { /* … */ },
  plugins: [],
}