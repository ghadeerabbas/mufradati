(function(){
const emptyQ={docs:[],size:0,empty:true,forEach(){},docChanges(){return[]},metadata:{hasPendingWrites:false,fromCache:false}};
function docRef(id,cn){const d={id:id||"x",get(){const v=(window.FAKEDOCS||{})[cn+"/"+id];return Promise.resolve({exists:!!v,id:d.id,data(){return v},get(k){return v&&v[k]}})},
 set(){return Promise.resolve()},update(){return Promise.resolve()},delete(){return Promise.resolve()},
 onSnapshot(...a){const cb=a.find(x=>typeof x==="function");setTimeout(()=>{try{cb&&cb({exists:false,id:d.id,data(){return undefined},metadata:{}})}catch(e){}},0);return()=>{}},
 collection(n){return coll(n)}};return d}
function coll(n){const c={doc(id){return docRef(id,n)},add(){return Promise.resolve(docRef("n"))},
 where(){return c},orderBy(){return c},limit(){return c},startAfter(){return c},limitToLast(){return c},
 get(){return Promise.resolve(emptyQ)},onSnapshot(...a){const cb=a.find(x=>typeof x==="function");setTimeout(()=>{try{cb&&cb(emptyQ)}catch(e){}},0);return()=>{}}};return c}
const user={uid:"testuid",email:"tester@mufradati.app",getIdToken(){return Promise.resolve("tok")},reauthenticateWithCredential(){return Promise.resolve()},updatePassword(){return Promise.resolve()}};
const authObj={currentUser:user,onAuthStateChanged(cb){setTimeout(()=>cb(user),0);return()=>{}},signOut(){return Promise.resolve()},signInWithEmailAndPassword(){return Promise.resolve({user})},setPersistence(){return Promise.resolve()}};
const fs=function(){return{collection:coll,batch(){return{set(){},update(){},delete(){},commit(){return Promise.resolve()}}},enablePersistence(){return Promise.resolve()},settings(){}}};
fs.FieldValue={serverTimestamp(){return new Date()},increment(n){return n},arrayUnion(){return[]},arrayRemove(){return[]},delete(){return null}};
fs.Timestamp={now(){return{toMillis(){return Date.now()}}},fromMillis(m){return{toMillis(){return m}}}};
const au=function(){return authObj};au.EmailAuthProvider={credential(){return{}}};au.Auth={Persistence:{LOCAL:"local"}};
window.firebase={initializeApp(){},auth:au,firestore:fs,apps:[1]};
})();
