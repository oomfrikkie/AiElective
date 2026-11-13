import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// What the JWT strategy puts on the request after checking the token.
export interface AuthUser {
  id: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
