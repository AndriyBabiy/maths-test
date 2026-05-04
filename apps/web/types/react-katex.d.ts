declare module 'react-katex' {
  import type { ComponentType, ReactNode } from 'react';

  interface KatexMathProps {
    math: string;
    errorColor?: string;
    renderError?: (error: Error) => ReactNode;
  }

  export const InlineMath: ComponentType<KatexMathProps>;
  export const BlockMath: ComponentType<KatexMathProps>;
}
