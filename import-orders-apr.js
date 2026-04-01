(async()=>{let C=[];try{C=JSON.parse(localStorage.getItem('becca_customers')||'[]')}catch(e){}
function fn(k){let c=C.find(x=>(x.namaShort||'').toLowerCase()===k.toLowerCase());if(c)return c.nama;c=C.find(x=>(x.nama||'').toLowerCase().includes(k.toLowerCase()));if(c)return c.nama;return{'NICI':'PT. NUGRAHA INDAH CITARASA INDONESIA','SHINTO':'PT. Shinto Kogyo Indonesia','DDMI':'PT. Daihatsu Drivetrain Manufacturing Indonesia (DDMI)','NBC':'PT. NBC INDONESIA','SSK':'SUPER STEEL KARAWANG','IFF':'International Flavors & Fragrances (IFF)','RESONAC':'PT. RESONAC MATERIALS INDONESIA','DAIKI':'PT. DAIKI ALMUNIUM INDUSTRI IND','AICC':'PT. Asian Isuzu Casting Center (AICC)','AWI':'PT. Akashi Wahana Indonesia','AWIM':'PT. AKASHI WAHANA INDONESIA (AWIM)'}[k]||null}
var NM={};['NBC','IFF','RESONAC','DAIKI','AWI','AWIM','AICC','DDMI'].forEach(k=>{NM[k]=fn(k);console.log(k+' -> '+(NM[k]||'NOT FOUND'))});
var R=[
['NBC','2026-04-01','Siti Rohimah ~ Iim',25,115,0,0,50,25,0,0,7,3,0,0,18,0],
['NBC','2026-04-02','Siti Rohimah ~ Iim',25,115,0,0,50,25,0,0,7,3,0,0,18,0],
['NBC','2026-04-03','Siti Rohimah ~ Iim',13,16,0,0,19,18,0,0,5,0,0,0,14,0],
['NBC','2026-04-04','Siti Rohimah ~ Iim',13,16,0,0,19,18,0,0,5,0,0,0,14,0],
['NBC','2026-04-05','Siti Rohimah ~ Iim',13,16,0,0,19,18,0,0,5,0,0,0,14,0],
['IFF','2026-04-01','Siti Rohimah ~ Iim',0,170,2,0,170,56,2,0,56,64,2,0,64,8],
['IFF','2026-04-02','Siti Rohimah ~ Iim',0,170,2,0,170,56,2,0,56,64,2,0,64,8],
['IFF','2026-04-03','Siti Rohimah ~ Iim',0,170,2,0,170,56,2,0,56,64,2,0,64,8],
['IFF','2026-04-04','Siti Rohimah ~ Iim',0,84,2,0,84,46,2,0,46,28,0,0,28,0],
['IFF','2026-04-05','Siti Rohimah ~ Iim',0,34,0,0,34,21,0,0,21,22,0,0,22,0],
['RESONAC','2026-04-01','Siti Rohimah ~ Iim',0,170,0,0,0,70,0,0,0,65,0,0,55,0],
['RESONAC','2026-04-02','Siti Rohimah ~ Iim',0,170,0,0,0,70,0,0,0,65,0,0,55,0],
['RESONAC','2026-04-03','Siti Rohimah ~ Iim',0,0,0,40,40,0,0,0,0,43,0,0,37,0],
['RESONAC','2026-04-04','Siti Rohimah ~ Iim',0,0,0,40,40,0,0,0,0,43,0,0,37,0],
['RESONAC','2026-04-05','Siti Rohimah ~ Iim',0,0,0,40,40,0,0,0,0,43,0,0,37,0],
['DAIKI','2026-04-01','Ikmal Musyadad',0,120,0,0,0,45,0,0,0,45,0,0,0,0],
['DAIKI','2026-04-02','Ikmal Musyadad',0,120,0,0,0,45,0,0,0,45,0,0,0,0],
['DAIKI','2026-04-03','Ikmal Musyadad',0,120,0,0,0,45,0,0,0,45,0,0,0,0],
['DAIKI','2026-04-04','Ikmal Musyadad',0,100,0,0,0,35,0,0,0,35,0,0,0,0],
['DAIKI','2026-04-05','Ikmal Musyadad',0,80,0,0,0,30,0,0,0,30,0,0,0,0],
['AWIM','2026-04-02','Ikmal Musyadad',0,26,3,0,0,0,0,0,0,0,0,0,0,0],
['AWIM','2026-04-03','Ikmal Musyadad',0,0,0,0,0,0,0,0,0,0,0,0,0,0],
['AWI','2026-04-01','Ikmal Musyadad',0,410,5,0,0,180,5,0,0,0,0,0,0,0],
['AWI','2026-04-02','Ikmal Musyadad',0,410,5,0,0,180,5,0,0,0,0,0,0,0],
['AWI','2026-04-03','Ikmal Musyadad',0,410,5,0,0,180,5,0,0,0,0,0,0,0],
['AWI','2026-04-04','Ikmal Musyadad',0,45,5,0,0,15,5,0,0,0,0,0,0,0],
['AWI','2026-04-05','Ikmal Musyadad',0,25,5,0,0,15,5,0,0,0,0,0,0,0],
['AICC','2026-04-01','Umayah',0,480,2,0,0,0,0,0,0,0,0,0,0,0],
['AICC','2026-04-02','Umayah',0,480,2,0,0,0,0,0,0,0,0,0,0,0],
['AICC','2026-04-03','Umayah',0,300,2,0,0,0,0,0,0,0,0,0,0,0],
['AICC','2026-04-04','Umayah',0,381,2,0,0,0,0,0,0,0,0,0,0,0],
['AICC','2026-04-05','Umayah',0,417,2,0,0,0,0,0,0,0,0,0,0,0],
['DDMI','2026-04-01','Umayah',0,0,0,0,0,0,0,0,0,100,1,0,0,0],
['DDMI','2026-04-02','Umayah',0,0,0,0,0,0,0,0,0,100,1,0,0,0],
['DDMI','2026-04-03','Umayah',0,0,0,0,0,0,0,0,0,2,0,0,0,0],
['DDMI','2026-04-04','Umayah',0,0,0,0,0,0,0,0,0,2,0,0,0,0],
['DDMI','2026-04-05','Umayah',0,0,0,0,0,0,0,0,0,2,0,0,0,0]
];
var O=[];try{O=JSON.parse(localStorage.getItem('becca_orders')||'[]')}catch(e){}
var uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
var now=new Date().toISOString();var up=0,ad=0;
for(var r of R){var nm=NM[r[0]];if(!nm){console.warn('skip:',r[0]);continue}
var low=nm.toLowerCase();var ei=O.findIndex(o=>(o.namaPerusahaan||'').toLowerCase()===low&&o.tglOrder===r[1]);
var obj={id:ei>=0?O[ei].id:uid(),namaPerusahaan:nm,tglOrder:r[1],pelapor:r[2],catatan:'Import Bot',
breakfast:r[3],shift1:r[4],spare1:r[5],ot1:r[6],snack1:r[7],
shift2:r[8],spare2:r[9],ot2:r[10],snack2:r[11],
shift3:r[12],spare3:r[13],ot3:r[14],snack3:r[15],snackBerat:r[16],
invoiced:false,timestamp:now};
if(ei>=0){if(O[ei].invoiced){obj.invoiced=true;obj.invoiceRef=O[ei].invoiceRef;obj.invoiceDate=O[ei].invoiceDate}O[ei]=obj;up++}else{O.push(obj);ad++}}
localStorage.setItem('becca_orders',JSON.stringify(O));
console.log('Saved. Added:'+ad+' Updated:'+up+' Total:'+O.length);
console.log('Syncing to DB...');var s=0;
for(var r of R){var nm=NM[r[0]];if(!nm)continue;var o=O.find(x=>(x.namaPerusahaan||'').toLowerCase()===nm.toLowerCase()&&x.tglOrder===r[1]);
if(o){try{await DB.saveOrder(Object.assign({},o));s++}catch(e){console.warn('err:',o.tglOrder,nm)}}}
console.log('DB synced: '+s+'/'+R.length);
if(window.OrderModule&&window.OrderModule.refreshFromStorage)window.OrderModule.refreshFromStorage();
console.log('DONE! Refresh halaman.')})()
