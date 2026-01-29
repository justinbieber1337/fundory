import { Controller, Get } from "@nestjs/common";
import { getAllTiers } from "./tier.config";

@Controller("tiers")
export class TiersController {
  @Get()
  list() {
    return { tiers: getAllTiers() };
  }
}
