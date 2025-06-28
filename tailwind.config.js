/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./public/**/*.html",      // public 하위 모든 HTML
    "./public/**/*.js",        // (HTML에서 분리한 스크립트가 있을 경우)
    "./src/**/*.{js,ts,vue}",  // 추후 React/Vue 등 추가 작업 대비
  ],
  theme: { extend: {} },
  plugins: [],
};

