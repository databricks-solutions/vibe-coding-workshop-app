| Entity | Columns | Relates to |
|---|---|---|
| REGION | r_regionkey | has many NATION |
| NATION | n_nationkey | has many CUSTOMER |
| CUSTOMER | c_custkey | has many ORDERS |
| ORDERS | o_orderkey, o_orderdate (main time dim) | has many LINEITEM |
| ORDERS | o_totalprice (tax included) | |
| LINEITEM | l_extendedprice (money) | belongs to ORDERS (o_orderkey) |
| LINEITEM | l_discount (0 to 1) | |
| LINEITEM | l_returnflag (R = returned) | |
