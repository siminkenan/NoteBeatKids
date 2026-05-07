/**
 * Express 5 tip düzeltmeleri — bu projede req.params ve req.query değerleri
 * her zaman string olarak kullanılıyor. Express 5'in string | string[] union
 * tipini basitleştirmek için global override yapılıyor.
 */
import "express";

declare module "express-serve-static-core" {
  interface Request {
    params: Record<string, string>;
    query: Record<string, string>;
  }
}
