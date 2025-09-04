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
  theme: {
    extend: {
      height: {
        38: '9.5rem',   // 152px
      },
      spacing: {
        38: '9.5rem',   // margin/padding에서도 같은 단위 사용 가능
      },
    },
  },
  plugins: [],
}
