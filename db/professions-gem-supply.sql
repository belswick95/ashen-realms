insert into eldervale_private.shop_stock(merchant,item,buy,sell,stock)
 select distinct merchant,'uncutGem',24,7,-1 from eldervale_private.shop_stock where item='fishingPole'
 on conflict(merchant,item) do nothing;
