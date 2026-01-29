import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type CurrentUser = {
  userId: string;
  telegramId: string;
};

export const CurrentUserDecorator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as CurrentUser;
  },
);
