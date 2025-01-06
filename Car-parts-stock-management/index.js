const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');

const app = express();
app.use(express.json());


// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// MySQL bağlantısı
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', // veritabanı kullanıcı adınızı buraya yazın
  password: 'berkay2004', // veritabanı şifrenizi buraya yazın
  database: 'stokyonetmedeneme' // veritabanı adınızı buraya yazın
});

// Express'te session kullanımı için yapılandırma
app.use(session({
  secret: 'gizliAnahtar', // Güvenli bir anahtar belirleyin
  resave: false,
  saveUninitialized: true,
}));

db.connect((err) => {
  if (err) {
    console.error('MySQL bağlantı hatası:', err);
  } else {
    console.log('MySQL veritabanına bağlanıldı.');
  }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  });

  app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
  });

  app.get('/talep-goruntule', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'talep-goruntule.html'));  // Talep görüntüleme sayfası
});

  
  // Login işlemi
app.post('/login', (req, res) => {
  const { e_posta, Sifre } = req.body;

  const query = 'SELECT * FROM users WHERE e_posta = ?';
  
  db.query(query, [e_posta], (err, results) => {
    if (err) {
      console.error('Veritabanı hatası:', err);
      return res.status(500).send('Bir hata oluştu');
    }

    if (results.length > 0) {
      const user = results[0];

      bcrypt.compare(Sifre, user.Sifre, (err, match) => {
        if (err) {
          console.error('Şifre doğrulama hatası:', err);
          return res.status(500).send('Bir hata oluştu');
        }

        if (match) {
          req.session.user = {
            id: user.id,
            role: user.rol,
            name: user.ad,
          };
       
          if (user.rol === 'Yönetici') {
            res.redirect('/yonetici-dashboard.html');
          } else if (user.rol === 'Stok Sorumlusu') {
            res.redirect('/stok-kontrol-dashboard.html');
          } else if (user.rol === 'Teknisyen') {
            res.redirect('/teknisyen-dashboard.html');
          } else {
            res.send('Bilinmeyen kullanıcı rolü.');
          }
        } else {
          res.send('Geçersiz e-posta veya şifre.');
        }
      });
    } else {
      res.send('Geçersiz e-posta veya şifre.');
    }
  });
});

  app.post('/register', (req, res) => {
    const { Ad, Soyad, e_posta, Sifre, Rol } = req.body;
    
    // Şifreyi hash'le
    bcrypt.hash(Sifre, 10, (err, hashedPassword) => {
      if (err) {
        console.error('Şifre hashleme hatası:', err);
        return res.status(500).send('Bir hata oluştu');
      }
  
      // SQL sorgusu ile kullanıcıyı veritabanına kaydet
      const query = 'INSERT INTO users (Ad, Soyad, e_posta, Sifre, Rol) VALUES (?, ?, ?, ?, ?)';
      db.query(query, [Ad, Soyad, e_posta, hashedPassword, Rol], (err, results) => {
        if (err) {
          console.error('Veritabanı hatası:', err);
          return res.status(500).send('Bir hata oluştu');
        }
        res.send('Kayıt başarılı!');
      });
    });
  });


  app.post('/add-part', (req, res) => {
    console.log(req.body); // Form verilerini console'a yazdır
    addPart(req, res);     // addPart fonksiyonunu çağır
  });

  // Yeni parça eklemek için POST işlemi
const addPart = (req, res) => {
  const { partName, partType, partPrice, partStock, depotID } = req.body;

  // 1. Parça ekleme sorgusu
  const query = 'INSERT INTO parcalar (Ad, Tur, Fiyat, StokSeviyesi) VALUES (?, ?, ?, ?)';
  
  db.query(query, [partName, partType, partPrice, partStock], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).send('Bir hata oluştu');
    }

    // Yeni eklenen parçanın ID'sini al
    const partID = results.insertId;

    // 2. EnvanterHareketi tablosuna ekleme işlemi (giriş hareketi)
    const inventoryMovementQuery = 'INSERT INTO envanterhareketi (ParcaID, Miktar, Tarih, HareketTürü, DepoID) VALUES (?, ?, NOW(), ?, ?)';
    
    // Burada "Giriş" olarak hareket türü belirleniyor (bu, parçanın envantere girişi için)
    const movementType = 'Giriş';

    db.query(inventoryMovementQuery, [partID, partStock, movementType, depotID], (err, inventoryResults) => {
      if (err) {
        console.log(err);
        return res.status(500).send('Envanter hareketi kaydedilemedi');
      }

      res.send('Yeni parça başarıyla eklendi ve envantere giriş hareketi kaydedildi!');
    });
  });
};



// parça güncelleme
app.post('/update-part', (req, res) => {
  console.log(req.body); // Form verilerini console'a yazdır
  updatePart(req, res);     // UpdatePart fonksiyonunu çağır
});

const updatePart = (req, res) => {
  const { partID, partName, partType, partPrice, partStock } = req.body;

  const query = 'UPDATE parcalar SET Ad = ?, Tur = ?, Fiyat = ?, StokSeviyesi = ? WHERE ParcaID = ?';

  db.query(query, [partName, partType, partPrice, partStock, partID], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).send('Bir hata oluştu');
    }

    // Eğer etkilenmiş satır sayısı 0 ise, parça bulunamadı
    if (results.affectedRows === 0) {
      return res.status(404).send('Parça bulunamadı');
    }

    res.send('Parça başarıyla güncellendi!');
  });
};

app.post('/delete-part', (req, res) => {
  console.log(req.body); // Form verilerini console'a yazdır
  deletePart(req, res);     // deletePart fonksiyonunu çağır
});

// parça silme
// Parça silme
const deletePart = (req, res) => {
  const { partID } = req.body;

  // Önce EnvanterHareketi tablosundaki ilişkili kayıtları sil
  const deleteInventoryQuery = 'DELETE FROM EnvanterHareketi WHERE ParcaID = ?';

  db.query(deleteInventoryQuery, [partID], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).send({ message: 'Envanter hareketi silinemedi' });
    }

    // Ardından Parca tablosundaki kaydı sil
    const deletePartQuery = 'DELETE FROM parcalar WHERE ParcaID = ?';

    db.query(deletePartQuery, [partID], (err, results) => {
      if (err) {
        console.log(err);
        return res.status(500).send({ message: 'Bir hata oluştu' });
      }

      // Eğer etkilenmiş satır sayısı 0 ise, parça bulunamadı
      if (results.affectedRows === 0) {
        return res.status(404).send('Parça bulunamadı');
      }

      res.send('Parça ve ilişkili envanter hareketi başarıyla silindi!');
    });
  });
};



app.post('/update-role-part', (req, res) => {
  console.log(req.body); 
  updateUserRole(req, res);     
});

// kullanici rolünü güncelleme 

const updateUserRole = (req, res) => {
  const { kullaniciID, newRole } = req.body;

  const query = 'UPDATE Users SET Rol = ? WHERE KullaniciID = ?';

  db.query(query, [newRole, kullaniciID], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).send('Bir hata oluştu');
    }
    if (results.affectedRows === 0) {
      return res.status(404).send('Kullanici bulunamadı');
    }
    res.send('Kullanıcı rolü başarıyla güncellendi!');
  });
};

app.post('/update-depo-part', (req, res) => {
  console.log(req.body); 
  updateDepo(req, res);     
});

// depo kapasitesi güncelleme

const updateDepo = (req, res) => {
  const { depoID, newCapacity } = req.body;

  // Depo ID'sinin mevcut olup olmadığını kontrol et
  const checkQuery = 'SELECT * FROM Depo WHERE DepoID = ?';

  db.query(checkQuery, [depoID], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).send('Bir hata oluştu');
    }

    // Eğer depo mevcut değilse
    if (results.length === 0) {
      return res.status(404).send('Böyle bir depo bulunamadı');
    }

    // Depo mevcutsa kapasiteyi güncelle
    const updateQuery = 'UPDATE Depo SET Kapasite = ? WHERE DepoID = ?';

    db.query(updateQuery, [newCapacity, depoID], (err, results) => {
      if (err) {
        console.log(err);
        return res.status(500).send('Bir hata oluştu');
      }
      res.send('Depo kapasitesi başarıyla güncellendi!');
    });
  });
};

// Parça stok güncelleme fonksiyonu
const updateStock = (req, res) => {
  const { partID, newStock } = req.body;

  // Veritabanı sorgusu
  const query = 'UPDATE parcalar SET StokSeviyesi = ? WHERE ParcaID = ?';

  db.query(query, [newStock, partID], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: 'Bir hata oluştu' });
    }

    // Etkilenen satır kontrolü
    if (results.affectedRows > 0) {
      res.json({ success: true, message: 'Stok başarıyla güncellendi!' });
    } else {
      res.status(404).json({ success: false, message: 'Parça bulunamadı' });
    }
  });
};

// Endpoint tanımlama
app.post('/update-stock', (req, res) => {
  console.log(req.body); // Gelen verileri kontrol et
  updateStock(req, res);
});

// Çıkış Endpoint'i
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          console.error('Çıkış sırasında bir hata oluştu:', err);
          return res.status(500).send('Çıkış sırasında bir hata oluştu.');
      }

      res.clearCookie('connect.sid'); // Session cookie'sini temizle
      res.sendStatus(200); // Başarılı yanıt gönder
  });
});

// parcalari görme

const getAllParts = (req, res) => {
  const query = 'SELECT * FROM parcalar';  // Parca tablosundaki tüm parçaları alıyoruz

  db.query(query, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).send('Bir hata oluştu');
    }
    res.json(results);  // Veritabanından çekilen parçaları JSON olarak döndürüyoruz
  });
};

// Parçaları getirme işlemi için route
app.get('/get-parts', getAllParts);

app.get('/api/get-parts', (req, res) => {
  const query = 'SELECT * FROM parcalar';
  db.query(query, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Parçalar alınamadı' });
    }
    res.json(results);
  });
});

app.post('/api/create-request', (req, res) => {
  const { partID, quantity } = req.body;

  // Eğer partID veya quantity eksikse hata döndür
  if (!partID || !quantity) {
    return res.status(400).json({ message: 'Parça ID ve Talep Miktarı gereklidir.' });
  }

  const query = `
    INSERT INTO talepler (ParcaID, TalepMiktari, TalepTarihi) 
    VALUES (?, ?, NOW())
  `;

  db.query(query, [partID, quantity], (err, results) => {
    if (err) {
      console.error('Talep oluşturulamadı:', err);
      return res.status(500).json({ message: 'Talep oluşturulamadı', success: false });
    }
    res.json({ message: 'Talep başarıyla oluşturuldu!', success: true });
  });
});

// cikis yapma ( teknisyen sayfası)
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Çıkış yapılırken bir hata oluştu.' });
    }
    res.json({ success: true, message: 'Başarıyla çıkış yapıldı.' });
  });
});

const TalepGoruntuleme = (req, res) => {
  // Sadece gerekli sütunları seçiyoruz: TalepID, ParcaID, TalepMiktari, TalepTarihi
  const query = 'SELECT TalepID, ParcaID, TalepMiktari, TalepTarihi FROM talepler';

  db.query(query, (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).send('Bir hata oluştu');
    }
    res.json(results);  // Veritabanından çekilen talepleri JSON olarak döndürüyoruz
  });
};

app.get('/api/get-request', TalepGoruntuleme);


app.post('/approve-request', (req, res) => {
  const { TalepID, ParcaID } = req.body;

  // Talep ve parça verilerini sorgulama
  const getTalepQuery = 'SELECT TalepMiktari FROM talepler WHERE TalepID = ?';
  const getParcaQuery = 'SELECT Fiyat FROM parcalar WHERE ParcaID = ?';

  db.query(getTalepQuery, [TalepID], (err, talepResult) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Talep verisi alınırken hata oluştu' });
    }

    if (talepResult.length === 0) {
      return res.status(404).json({ message: 'Talep bulunamadı' });
    }

    const miktar = talepResult[0].TalepMiktari;

    // Parça fiyatını al
    db.query(getParcaQuery, [ParcaID], (err, parcaResult) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Parça verisi alınırken hata oluştu' });
      }

      if (parcaResult.length === 0) {
        return res.status(404).json({ message: 'Parça bulunamadı' });
      }

      const fiyat = parcaResult[0].Fiyat;

      // Tutarı hesapla
      const tutar = miktar * fiyat;
      const faturaTarihi = new Date().toISOString().split('T')[0]; // YYYY-MM-DD formatında tarih

      // Fatura ekleme sorgusu
      const insertFaturaQuery = 'INSERT INTO fatura (FaturaTarihi, Tutar, ParcaID) VALUES (?, ?, ?)';
      const deleteTalepQuery = 'DELETE FROM talepler WHERE TalepID = ?';

      db.query(insertFaturaQuery, [faturaTarihi, tutar, ParcaID], (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: 'Fatura eklenirken hata oluştu' });
        }

        // Talebi sil
        db.query(deleteTalepQuery, [TalepID], (err) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Talep silinirken hata oluştu' });
          }
          res.json({ message: 'Talep onaylandı, fatura eklendi ve talep silindi' });
        });
      });
    });
  });
});

// Talebi reddetme (sadece talebi silme işlemi)
app.post('/reject-request', (req, res) => {
  const { TalepID } = req.body;

  const deleteTalepQuery = 'DELETE FROM talepler WHERE TalepID = ?';
  db.query(deleteTalepQuery, [TalepID], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Talep silinirken hata oluştu' });
    }
    res.json({ message: 'Talep reddedildi ve silindi' });
  });
});


// Sunucu başlatma
app.listen(3000, () => {
  console.log('Sunucu 3000 portunda çalışıyor...');
});
