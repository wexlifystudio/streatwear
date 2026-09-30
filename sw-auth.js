/* Streat Wear — customer accounts helper (shared by index.html and account.html)
   Talks to the customer_* functions from account-system.sql. */
(function(){
  var TOKEN_KEY = 'sw_cust_token';
  var PROFILE_KEY = 'sw_cust_profile';
  var sb = null;
  var listeners = [];

  // Bangladesh divisions -> districts (64 districts)
  var BD = {
    'Dhaka': ['Dhaka','Faridpur','Gazipur','Gopalganj','Kishoreganj','Madaripur','Manikganj','Munshiganj','Narayanganj','Narsingdi','Rajbari','Shariatpur','Tangail'],
    'Chattogram': ['Bandarban','Brahmanbaria','Chandpur','Chattogram','Cumilla',"Cox's Bazar",'Feni','Khagrachhari','Lakshmipur','Noakhali','Rangamati'],
    'Rajshahi': ['Bogura','Chapainawabganj','Joypurhat','Naogaon','Natore','Pabna','Rajshahi','Sirajganj'],
    'Khulna': ['Bagerhat','Chuadanga','Jashore','Jhenaidah','Khulna','Kushtia','Magura','Meherpur','Narail','Satkhira'],
    'Barishal': ['Barguna','Barishal','Bhola','Jhalokati','Patuakhali','Pirojpur'],
    'Sylhet': ['Habiganj','Moulvibazar','Sunamganj','Sylhet'],
    'Rangpur': ['Dinajpur','Gaibandha','Kurigram','Lalmonirhat','Nilphamari','Panchagarh','Rangpur','Thakurgaon'],
    'Mymensingh': ['Jamalpur','Mymensingh','Netrokona','Sherpur']
  };

  function getToken(){ try{ return localStorage.getItem(TOKEN_KEY) || ''; }catch(e){ return ''; } }
  function getProfile(){
    try{ return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); }catch(e){ return null; }
  }
  function setSession(token, customer){
    try{
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(customer));
    }catch(e){}
    notify();
  }
  function setProfile(customer){
    try{ localStorage.setItem(PROFILE_KEY, JSON.stringify(customer)); }catch(e){}
    notify();
  }
  function clearSession(){
    try{ localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(PROFILE_KEY); }catch(e){}
    notify();
  }
  function notify(){
    var p = getProfile();
    listeners.forEach(function(fn){ try{ fn(p); }catch(e){ console.error(e); } });
  }

  function friendly(msg){
    msg = String(msg || '');
    if(/Could not find the function|schema cache|does not exist/i.test(msg)){
      return 'The account system is not set up yet. (Owner: run account-system.sql in Supabase.)';
    }
    return msg || 'Something went wrong. Please try again.';
  }
  async function rpc(fn, args){
    if(!sb) throw new Error('Not ready yet. Please try again.');
    var res = await sb.rpc(fn, args);
    if(res.error) throw new Error(friendly(res.error.message));
    return res.data;
  }

  async function signup(o){
    var data = await rpc('customer_signup', { p_name:o.name, p_phone:o.phone, p_email:o.email, p_password:o.password });
    setSession(data.token, data.customer);
    return data.customer;
  }
  async function login(ident, password){
    var data = await rpc('customer_login', { p_ident:ident, p_password:password });
    if(data && data.error) throw new Error(data.error);
    setSession(data.token, data.customer);
    return data.customer;
  }
  async function logout(){
    var t = getToken();
    clearSession();
    if(t){ try{ await rpc('customer_logout', { p_token:t }); }catch(e){} }
  }
  async function me(){
    var t = getToken();
    if(!t) return null;
    try{
      var c = await rpc('customer_me', { p_token:t });
      if(!c){ clearSession(); return null; }
      setProfile(c);
      return c;
    }catch(e){ return getProfile(); }   // network problem: keep the cached profile
  }
  async function updateProfile(o){
    var c = await rpc('customer_update', { p_token:getToken(), p_name:o.name, p_phone:o.phone, p_address:o.address || null });
    setProfile(c);
    return c;
  }
  async function orders(){
    return await rpc('customer_orders', { p_token:getToken() });
  }

  // Division -> District selects
  function setupGeo(divSel, distSel){
    if(!divSel || !distSel) return;
    if(divSel.options.length < 2){
      divSel.innerHTML = '<option value="">Select division</option>' + Object.keys(BD).map(function(d){ return '<option value="' + d + '">' + d + '</option>'; }).join('');
    }
    function fillDistricts(){
      var list = BD[divSel.value] || [];
      distSel.innerHTML = '<option value="">' + (list.length ? 'Select district' : 'Select division first') + '</option>' + list.map(function(d){ return '<option value="' + d + '">' + d + '</option>'; }).join('');
      distSel.disabled = !list.length;
    }
    divSel.addEventListener('change', fillDistricts);
    if(divSel.form) divSel.form.addEventListener('reset', function(){ setTimeout(fillDistricts, 0); });
    fillDistricts();
  }
  function setGeoValues(divSel, distSel, division, district){
    if(!divSel || !distSel) return;
    if(division && BD[division]){
      divSel.value = division;
      divSel.dispatchEvent(new Event('change'));
      if(district) distSel.value = district;
    }
  }

  // Pretty text for the address object
  function addressText(a){
    if(!a) return '';
    var lines = [];
    if(a.division) lines.push('Division: ' + a.division);
    if(a.district) lines.push('District: ' + a.district);
    if(a.area) lines.push('Area: ' + a.area);
    if(a.full) lines.push('Address: ' + a.full);
    if(a.landmark) lines.push('Landmark: ' + a.landmark);
    return lines.join('\n');
  }

  window.SWAuth = {
    BD: BD,
    init: function(client){
      sb = client;
      notify();          // cached profile first, so the page can react instantly
      me().then(notify); // then confirm with the server
    },
    onChange: function(fn){ listeners.push(fn); try{ fn(getProfile()); }catch(e){} },
    getToken: getToken,
    getProfile: getProfile,
    isLoggedIn: function(){ return !!getToken() && !!getProfile(); },
    signup: signup, login: login, logout: logout, me: me,
    updateProfile: updateProfile, orders: orders,
    setupGeo: setupGeo, setGeoValues: setGeoValues, addressText: addressText
  };
})();
