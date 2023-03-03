const express = require("express");
const app = express();
const mysql = require("mysql");
const cors = require("cors");

app.use(cors());
app.use(express.json()); //Axios automatic transforms JSON so this is no need

const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "",
  database: "db19",
  dateStrings: true,
});

app.listen(1802, () => {
  console.log("1802 running~");
});

//取得菜單全部資料
app.get("/menu", (req, res) => {
  db.query("SELECT * FROM `Menu`", (err, result) => res.send(result));
});

//取得購物車總數
app.post("/totalquantity", (req, res) => {
  const tableNum = req.body.tableNum;
  db.query(
    "SELECT SUM(quantity) AS quantity FROM `Cart` WHERE `tableNum` = ?",
    [tableNum],
    (err, result) => res.send(result)
  );
});

//取得已點總數
app.post("/totalorder", (req, res) => {
  const tableNum = req.body.tableNum;
  db.query(
    "SELECT SUM(quantity) AS quantity FROM OrderList WHERE orderTable = ? AND checkout = 0",
    [tableNum],
    (err, result) => res.send(result)
  );
});

//加入購物車功能(判斷購物車資料表內容)
app.post("/addtocart", (req, res) => {
  const tableNum = req.body.tableNum;
  const itemNum = req.body.itemNum;
  const quantity = req.body.quantity;
  const sql =
    "SELECT `itemNum`, `quantity`, `tableNum` from `Cart` where `tableNum` = ? and `itemNum` = ?";
  db.query(sql, [tableNum, itemNum], (err, result) => {
    if (result.length == 0) {
      db.query(
        "INSERT INTO `Cart` (tableNum, itemNum, quantity) VALUES (?,?,?)",
        [tableNum, itemNum, quantity]
      );
    } else {
      const newQuantity = result[0].quantity + quantity;
      db.query(
        "UPDATE `Cart` SET `quantity` = ? WHERE `itemNum` = ? AND `tableNum` = ?",
        [newQuantity, itemNum, tableNum]
      );
    }
  });
});

//取得購物車資料
app.post("/cart", (req, res) => {
  const tableNum = req.body.tableNum;
  const sql =
    "SELECT Cart.itemNum, `quantity`, `tableNum`, `mealName`, `price`, `image` FROM `Cart`, `Menu` WHERE `tableNum` = ? AND Cart.itemNum = Menu.itemNum ORDER BY cartID";
  db.query(sql, [tableNum], (err, result) => res.send(result));
});

//用菜單資料對應購物車內容 多的 他媽有病？
// app.post("/mealdata", (req, res) => {
//   const itemNum = req.body.itemNum;
//   db.query("SELECT * FROM Menu WHERE itemNum = ?", [itemNum], (err, result) =>
//     res.send(result)
//   );
// });

//修改購物車數量
app.post("/adjustcart", (req, res) => {
  const itemNum = req.body.itemNum;
  const tableNum = req.body.tableNum;
  const quantity = req.body.quantity;
  if (quantity === 0) {
    const sql = "DELETE FROM `Cart` WHERE `itemNum` = ? AND `tableNum` = ?";
    db.query(sql, [itemNum, tableNum]);
  } else {
    const sql =
      "UPDATE `Cart` SET `quantity` = ? WHERE `itemNum` = ? AND `tableNum` = ?";
    db.query(sql, [quantity, itemNum, tableNum]);
  }
});

//將購物車加入訂單
app.post("/sendorder", (req, res) => {
  const tableNum = req.body.tableNum;
  const sql1 =
    "INSERT INTO `OrderList` (itemNum, quantity, orderTable, deliverTable) SELECT `itemNum`, `quantity`, `tableNum`, `tableNum` FROM `Cart` WHERE `tableNum` = ?";
  db.query(sql1, [tableNum]);
  const sql2 = "DELETE FROM `Cart` WHERE `tableNum` = ? ";
  db.query(sql2, [tableNum]);
  const sql3 =
    "INSERT INTO OrderInfo (deliverTable, createTime) SELECT DISTINCT deliverTable, createTime FROM OrderList,(SELECT MAX(createTime) AS lastTime FROM OrderList) AS lastTimeTable WHERE OrderList.createTime = lastTimeTable.lastTime;";
  db.query(sql3);
});

//請酒功能加入訂單
app.post("/buyudrink", (req, res) => {
  const itemNum = req.body.itemNum;
  const orderTable = req.body.orderTable;
  const deliverTable = req.body.deliverTable;
  const remark = req.body.remark;
  const sql1 =
    "INSERT INTO OrderList (itemNum, quantity, orderTable, deliverTable, remark) VALUES (?, ?, ?, ?, ?)";
  db.query(sql1, [itemNum, 1, orderTable, deliverTable, remark]);
  const sql2 =
    "INSERT INTO OrderInfo (deliverTable, createTime) SELECT DISTINCT deliverTable, createTime FROM OrderList,(SELECT MAX(createTime) AS lastTime FROM OrderList) AS lastTimeTable WHERE OrderList.createTime = lastTimeTable.lastTime;";
  db.query(sql2);
});

//客人取得訂單資料
app.post("/order", (req, res) => {
  const tableNum = req.body.tableNum;
  const sql =
    "SELECT OrderList.itemNum, `quantity` ,IF(doneOrNot>0, '已出餐', '準備中' ) AS doneOrNot, `mealName`, `image` FROM `OrderList`, `Menu`  WHERE `orderTable` = ? AND checkout = 0 AND OrderList.itemNum = Menu.itemNum ORDER BY `orderID`;";
  db.query(sql, [tableNum], (err, result) => {
    res.send(result);
  });
});

//廚房取得訂單數量
app.get("/orderinfo", (req, res) => {
  db.query(
    "SELECT orderListID, deliverTable, createTime FROM OrderInfo WHERE allDone = 0;",
    (err, result) => res.send(result)
  );
});

//廚房取得有訂單桌號
app.get("/tablenum", (req, res) => {
  db.query(
    "SELECT DISTINCT deliverTable FROM OrderInfo WHERE allDone = 0;",
    (err, result) => res.send(result)
  );
});

//廚房取得訂單細節
app.post("/orderlist", (req, res) => {
  const deliverTable = req.body.deliverTable;
  const createTime = req.body.createTime;
  const sql =
    "SELECT OrderList.itemNum, quantity, mealName, doneOrNot, orderTable, deliverTable, createTime, remark FROM OrderList, Menu WHERE deliverTable = ? AND createTime = ? AND OrderList.itemNum = Menu.itemNum ORDER BY orderID;";
  db.query(sql, [deliverTable, createTime], (err, result) => res.send(result));
});

//修改餐點完成與否
app.post("/handleitemdone", (req, res) => {
  const itemNum = req.body.itemNum;
  const deliverTable = req.body.deliverTable;
  const createTime = req.body.createTime;
  const doneOrNot = req.body.doneOrNot;
  const sql =
    "UPDATE OrderList SET doneOrNot = ? WHERE itemNum = ? AND deliverTable = ? AND createTime = ?";
  doneOrNot === 0
    ? db.query(sql, [1, itemNum, deliverTable, createTime])
    : db.query(sql, [0, itemNum, deliverTable, createTime]);
  const sql1 =
    "SELECT COUNT(*) AS done FROM `OrderList` WHERE deliverTable = ? AND createTime = ? UNION  SELECT COUNT(*) AS done FROM `OrderList` WHERE deliverTable = ? AND createTime = ? AND doneOrNot = 1;";
  const sql2 =
    "UPDATE OrderInfo SET allDone = 1 WHERE deliverTable = ? AND createTime = ?";
  db.query(
    sql1,
    [deliverTable, createTime, deliverTable, createTime],
    (err, result) => {
      if (result.length === 1) {
        db.query(sql2, [deliverTable, createTime]);
        res.send(result);
      }
    }
  );
});

//取得單桌準備中
app.post("/tableandtime", (req, res) => {
  const deliverTable = req.body.deliverTable;
  const sql =
    "SELECT deliverTable, createTime FROM OrderInfo WHERE deliverTable = ? AND allDone = 0";
  db.query(sql, [deliverTable], (err, result) => res.send(result));
});

//取得準備中品項
app.post("/ongoingitem", (req, res) => {
  const deliverTable = req.body.deliverTable;
  const createTime = req.body.createTime;
  const sql =
    "SELECT OrderList.itemNum, quantity, mealName FROM OrderList, Menu WHERE deliverTable = ? AND createTime = ? AND doneOrNot = 0 AND OrderList.itemNum = Menu.itemNum";
  db.query(sql, [deliverTable, createTime], (err, result) => res.send(result));
});

//取得已出餐待結帳品項
app.post("/doneitem", (req, res) => {
  const orderTable = req.body.orderTable;
  const sql =
    "SELECT OrderList.itemNum, quantity, mealName, price FROM OrderList, Menu WHERE OrderList.itemNum = Menu.itemNum AND doneOrNot = 1 AND checkout = 0 AND orderTable = ?";
  db.query(sql, [orderTable], (err, result) => res.send(result));
});

//取得總金額
app.post("/total", (req, res) => {
  const orderTable = req.body.orderTable;
  const sql =
    "SELECT SUM(o.quantity * m.price) AS total FROM OrderList AS o, Menu AS m WHERE o.itemNum = m.itemNum AND o.doneOrNot = 1 AND o.checkout = 0 AND o.orderTable = ?;";
  db.query(sql, [orderTable], (err, result) => res.send(result));
});

//入座呼叫與否
app.get("/tablestate", (req, res) => {
  const sql = "SELECT * FROM SeatedAndCall;";
  db.query(sql, (err, result) => res.send(result));
});

//結帳!!!
app.post("/checkout", (req, res) => {
  const orderTable = req.body.orderTable;
  const sql =
    "UPDATE SeatedAndCall AS s, OrderList AS l, OrderInfo AS i SET s.seated = 0, s.called = 0, l.checkout = 1, i.checkOut = 1 WHERE s.tableNum = ? AND l.orderTable = ? AND i.deliverTable = ?;";
  db.query(sql, [orderTable, orderTable, orderTable]);
});

//設定客人入坐
app.post("/seated", (req, res) => {
  const orderTable = req.body.orderTable;
  const boolean = req.body.boolean;
  const sql = "UPDATE SeatedAndCall SET seated = ? WHERE tableNum = ?;";
  db.query(sql, [boolean, orderTable]);
});

//設定客人按服務鈴
app.post("/callserver", (req, res) => {
  const tableNum = req.body.tableNum;
  const sql = "UPDATE SeatedAndCall SET called = 1 WHERE tableNum = ?;";
  db.query(sql, [tableNum]);
});

//單桌入座呼叫與否
app.post("/tablestatus", (req, res) => {
  const tableNum = req.body.tableNum;
  const sql = "SELECT * FROM SeatedAndCall WHERE tableNum = ?;";
  db.query(sql, [tableNum], (err, result) => res.send(result));
});

//取消服務鈴
app.post("/cancelcalled", (req, res) => {
  const tableNum = req.body.tableNum;
  const sql = "UPDATE SeatedAndCall SET called = 0 WHERE tableNum = ?;";
  db.query(sql, [tableNum]);
});
