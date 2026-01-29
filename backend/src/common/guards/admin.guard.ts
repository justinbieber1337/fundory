import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = request.headers["x-admin-token"];
    const expected = this.config.get<string>("ADMIN_TOKEN");
    if (!expected || token !== expected) {
      throw new UnauthorizedException("Invalid admin token");
    }
    return true;
  }
}
