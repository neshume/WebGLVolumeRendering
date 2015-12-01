

var TESLA = { REVISION: '1' };



if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

var container, stats;
var camera, sceneFirstPass, sceneSecondPass, renderer;

var clock = new THREE.Clock();
var rtTexture, transferTexture;
var cubeTextures = ['heart'];
var histogram = [];
var guiControls;

var materialSecondPass;
var controls;


TESLA.init = function() {

    //Parameters that can be modified.
    guiControls = new function() {
        this.model = 'bonsai';
        this.steps = 256.0;
        this.alphaCorrection = 0.10;
        this.color1 = "#00FA58";
        this.stepPos1 = 0.1;
        this.color2 = "#CC6600";
        this.stepPos2 = 0.7;
        this.color3 = "#F2F200";
        this.stepPos3 = 1.0;
    };

    container = document.getElementById( 'container' );

    camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 0.01, 3000.0 );
    camera.position.z = 2.0;

    controls = new THREE.OrbitControls( camera, container );
    controls.center.set( 0.0, 0.0, 0.0 );

    //Load the 2D texture containing the Z slices.
    cubeTextures['heart'] = THREE.ImageUtils.loadTexture('heartResult.png');


    var transferTexture = TESLA.updateTransferFunction();

    var screenSize = new THREE.Vector2( window.innerWidth, window.innerHeight );
    rtTexture = new THREE.WebGLRenderTarget( screenSize.x, screenSize.y, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBFormat, type: THREE.FloatType } );

    rtTexture.wrapS = rtTexture.wrapT = THREE.ClampToEdgeWrapping;

    var materialFirstPass = new THREE.ShaderMaterial( {
        vertexShader: document.getElementById( 'vertexShaderFirstPass' ).textContent,
        fragmentShader: document.getElementById( 'fragmentShaderFirstPass' ).textContent,
        side: THREE.BackSide
    } );

    materialSecondPass = new THREE.ShaderMaterial( {
        vertexShader: document.getElementById( 'vertexShaderSecondPass' ).textContent,
        fragmentShader: document.getElementById( 'fragmentShaderSecondPass' ).textContent,
        side: THREE.FrontSide,
        uniforms: {	tex:  { type: "t", value: rtTexture },
            cubeTex:  { type: "t", value: cubeTextures['heart'] },
            transferTex:  { type: "t", value: transferTexture },
            steps : {type: "1f" , value: guiControls.steps },
            alphaCorrection : {type: "1f" , value: guiControls.alphaCorrection }}
    });


    sceneFirstPass = new THREE.Scene();
    sceneSecondPass = new THREE.Scene();

    var boxGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    boxGeometry.doubleSided = true;

    var meshFirstPass = new THREE.Mesh( boxGeometry, materialFirstPass );
    var meshSecondPass = new THREE.Mesh( boxGeometry, materialSecondPass );

    sceneFirstPass.add( meshFirstPass );
    sceneSecondPass.add( meshSecondPass );

    renderer = new THREE.WebGLRenderer();
    container.appendChild( renderer.domElement );

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild( stats.domElement );


    var gui = new dat.GUI();
    var modelSelected = gui.add(guiControls, 'model', [ 'heart'] );
    gui.add(guiControls, 'steps', 0.0, 512.0);
    gui.add(guiControls, 'alphaCorrection', 0.01, 5.0).step(0.01);

    modelSelected.onChange(function(value) { materialSecondPass.uniforms.cubeTex.value =  cubeTextures[value]; } );


    //Setup transfer function steps.
    var step1Folder = gui.addFolder('Step 1');
    var controllerColor1 = step1Folder.addColor(guiControls, 'color1');
    var controllerStepPos1 = step1Folder.add(guiControls, 'stepPos1', 0.0, 1.0);
    controllerColor1.onChange(TESLA.updateTextures);
    controllerStepPos1.onChange(TESLA.updateTextures);

    var step2Folder = gui.addFolder('Step 2');
    var controllerColor2 = step2Folder.addColor(guiControls, 'color2');
    var controllerStepPos2 = step2Folder.add(guiControls, 'stepPos2', 0.0, 1.0);
    controllerColor2.onChange(TESLA.updateTextures);
    controllerStepPos2.onChange(TESLA.updateTextures);

    var step3Folder = gui.addFolder('Step 3');
    var controllerColor3 = step3Folder.addColor(guiControls, 'color3');
    var controllerStepPos3 = step3Folder.add(guiControls, 'stepPos3', 0.0, 1.0);
    controllerColor3.onChange(TESLA.updateTextures);
    controllerStepPos3.onChange(TESLA.updateTextures);

    step1Folder.open();
    step2Folder.open();
    step3Folder.open();


    onWindowResize();

    window.addEventListener( 'resize', onWindowResize, false );

}

TESLA.updateTextures = function(value)
{
    materialSecondPass.uniforms.transferTex.value = TESLA.updateTransferFunction();
}


TESLA.updateTransferFunction = function()
{
    var canvas = document.createElement('canvas');
    canvas.height = 20;
    canvas.width = 256;

    var ctx = canvas.getContext('2d');

    var grd = ctx.createLinearGradient(0, 0, canvas.width -1 , canvas.height - 1);
    grd.addColorStop(guiControls.stepPos1, guiControls.color1);
    grd.addColorStop(guiControls.stepPos2, guiControls.color2);
    grd.addColorStop(guiControls.stepPos3, guiControls.color3);

    ctx.fillStyle = grd;
    ctx.fillRect(0,0,canvas.width -1 ,canvas.height -1 );

    var img = document.getElementById("transferFunctionImg");
    img.src = canvas.toDataURL();
    img.style.width = "256 px";
    img.style.height = "128 px";

    transferTexture =  new THREE.Texture(canvas);
    transferTexture.wrapS = transferTexture.wrapT =  THREE.ClampToEdgeWrapping;
    transferTexture.needsUpdate = true;

    return transferTexture;
}

onWindowResize = function( event ) {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}

TESLA.animate = function()
{

    requestAnimationFrame( TESLA.animate );

    TESLA.render();
    stats.update();
}

TESLA.render = function() {

    var delta = clock.getDelta();

    //Render first pass and store the world space coords of the back face fragments into the texture.
    renderer.render( sceneFirstPass, camera, rtTexture, true );

    //Render the second pass and perform the volume rendering.
    renderer.render( sceneSecondPass, camera );

    materialSecondPass.uniforms.steps.value = guiControls.steps;
    materialSecondPass.uniforms.alphaCorrection.value = guiControls.alphaCorrection;
}



