const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors()); // 允許跨網域存取

// --- 1. 資料庫連線設定 ---
// 這裡的字串會優先讀取 Render 的環境變數 MONGODB_URI
const MONGODB_URI = process.env.MONGODB_URI || "你的測試用連線字串";

mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ 成功連線至 MongoDB"))
  .catch(err => console.error("❌ MongoDB 連線失敗:", err));

// --- 2. 定義訊息格式 (Schema) ---
const messageSchema = new mongoose.Schema({
  username: String,
  text: String,
  time: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // 實際部署時建議填入你的前端網址
    methods: ["GET", "POST"]
  }
});

// --- 3. Socket.io 即時通訊邏輯 ---
io.on('connection', async (socket) => {
  console.log('一位使用者連線了');

  // A. 連線成功後，自動發送最近 50 筆歷史紀錄
  try {
    const history = await Message.find().sort({ time: 1 }).limit(50);
    socket.emit('history', history);
  } catch (err) {
    console.error("抓取紀錄失敗:", err);
  }

  // B. 當收到新訊息
  socket.on('chat message', async (data) => {
    try {
      // 儲存到資料庫
      const newMessage = new Message({
        username: data.username,
        text: data.text
      });
      await newMessage.save();

      // 廣播訊息給所有人
      io.emit('chat message', {
        username: data.username,
        text: data.text
      });
    } catch (err) {
      console.error("儲存訊息失敗:", err);
    }
  });

  socket.on('disconnect', () => {
    console.log('使用者斷開連線');
  });
});

// --- 4. 啟動伺服器 ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`伺服器正在運行於 port ${PORT}`);
});
