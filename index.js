"use strict";
const canvas = document.getElementById("canvas");
const canvasWidth = canvas.width = window.innerWidth;
const canvasHeight = canvas.height = window.innerHeight;
const gl = canvas.getContext("webgl2");
function resizeCanvasToDisplaySize(canvas) {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const needResize = canvas.width !== displayWidth ||
        canvas.height !== displayHeight;
    if (needResize) {
        // Make the canvas the same size
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }
    return needResize;
}
//@ts-ignore
const mat4 = window.mat4;
gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LEQUAL);
gl.enable(gl.CULL_FACE);
gl.getExtension("EXT_color_buffer_float");
function main() {
    const PERSPECTIVE_PROJECTION = m4.perspective(degToRad(60), canvasWidth / canvasHeight, 1, 100000);
    const program = createProgramFromScripts("demo");
    const skyboxProgram = createProgramFromScripts("skybox");
    const bloomProgram = createProgramFromScripts("bloom");
    const hdrProgram = createProgramFromScripts("hdr");
    let cameraPos = [0, 0, -1];
    let cameraTarget = [0, 0, -1000];
    let lightPoses = [
        [0, 800, -100],
        [0, 800, -100],
        [0, -100, -500],
        [500, 100, -500],
    ];
    let lightTarget = [50, 1, -400];
    const { framebuffer: extractBrightnessFramebuffer, textures: [hdrTex, bloomTex] } = createFramebuffer(gl.RGBA16F, gl.RGBA, 2, canvasWidth, canvasHeight, gl.FLOAT, true);
    const { framebuffer: bloomBlurFramebuffer1, textures: [bloomResultTex1] } = createFramebuffer(gl.RGBA16F, gl.RGBA, 2, canvasWidth, canvasHeight, gl.FLOAT, true);
    const { framebuffer: bloomBlurFramebuffer2, textures: [bloomResultTex2] } = createFramebuffer(gl.RGBA16F, gl.RGBA, 2, canvasWidth, canvasHeight, gl.FLOAT, true);
    const horizontalLoc = gl.getUniformLocation(bloomProgram, "horizontal");
    const uModelMat = m4.translation(0, 0, -900);
    const uLightViewMat = m4.inverse(m4.lookAt(lightPoses[0], lightTarget, [0, 1, 0]));
    const uLightPerspective = m4.perspective(degToRad(90), 1, 1, 100000);
    // const shadowUniforms: UniformOBJ[] = [
    // 	[gl.getUniformLocation(shadowProgram, "uProjection")!, uLightPerspective],
    // 	[gl.getUniformLocation(shadowProgram, "uModel")!, uModelMat],
    // ]
    // const shadowAttribute: BufferObj[] = [
    // 	[gl.getAttribLocation(shadowProgram, "aPos")!, createBuffer([...cubeVertex, ...planeVertex]), 3],
    // ]
    //普通程序全局变量
    const viewMat = [
        gl.getUniformLocation(program, "uView"),
        m4.inverse(m4.lookAt(cameraPos, cameraTarget, [0, 1, 0])),
    ];
    const spaceTextureSize = 1024;
    const spaceTexture = createCubeTexture(gl.RGBA, gl.RGBA, spaceTextureSize, [
        // "./skybox/stars/starmap_2020_16k/starmap_2020_16k_px.jpg",
        // "./skybox/stars/starmap_2020_16k/starmap_2020_16k_mx.jpg",
        // "./skybox/stars/starmap_2020_16k/starmap_2020_16k_my.jpg",
        // "./skybox/stars/starmap_2020_16k/starmap_2020_16k_py.jpg",
        // "./skybox/stars/starmap_2020_16k/starmap_2020_16k_pz.jpg",
        // "./skybox/stars/starmap_2020_16k/starmap_2020_16k_mz.jpg",
        "./skybox/right.jpg",
        "./skybox/left.jpg",
        "./skybox/top.jpg",
        "./skybox/bottom.jpg",
        "./skybox/front.jpg",
        "./skybox/back.jpg",
    ], requestAnimationFrame.bind(null, drawScene));
    const spaceUniforms = [
        [
            gl.getUniformLocation(skyboxProgram, "uCamera"),
            m4.inverse(m4.multiply(PERSPECTIVE_PROJECTION, viewMat[1]))
        ]
    ];
    const spaceVAO = createVAO([
        {
            data: skyboxVertex, location: 10, size: 2
        }
    ]);
    const bloomVAO = createVAO([
        {
            data: skyboxVertex,
            size: 2,
            location: 10,
        },
        {
            data: skyboxCoord,
            size: 2,
            location: 11
        },
    ]);
    const bloomTextures = [
        [gl.getUniformLocation(bloomProgram, "tex"), bloomTex],
    ];
    const hdrTextures = [
        [gl.getUniformLocation(hdrProgram, "bloomTex"), bloomResultTex1],
        [gl.getUniformLocation(hdrProgram, "hdrTex"), hdrTex],
    ];
    const demoSkyboxLoc = gl.getUniformLocation(program, "skybox");
    const uniforms = [
        [
            gl.getUniformLocation(program, "uProjection"),
            PERSPECTIVE_PROJECTION,
        ],
        [gl.getUniformLocation(program, "uModel"), uModelMat],
        [gl.getUniformLocation(program, "materia.shininess"), 100],
        [
            gl.getUniformLocation(program, "uLightMatrix"),
            m4.multiply([
                0.5, 0.0, 0.0, 0.0,
                0.0, 0.5, 0.0, 0.0,
                0.0, 0.0, 0.5, 0.0,
                0.5, 0.5, 0.5, 1.0
            ], m4.multiply(uLightPerspective, uLightViewMat))
        ],
        viewMat,
        ...lightPoses.map((lightPos, i) => [
            gl.getUniformLocation(program, `lights[${i}].position`),
            lightPos,
        ]),
        ...lightPoses.map((_, i) => [
            gl.getUniformLocation(program, `lights[${i}].ambient`),
            [1, 1, 1],
        ]),
    ];
    const objectVAO = createVAO([
        {
            data: earthV,
            location: 0,
        },
        {
            data: earthNormals,
            location: 1,
        },
        {
            data: earthTexcoord,
            size: 2,
            location: 2
        }
    ]);
    gl.bindVertexArray(objectVAO);
    const numObjects = 400; //绘制十个物体
    const objectsMatrix = new Float32Array(numObjects * 16); //十个物体的变化矩阵
    const matrices = [];
    const len = 16;
    for (let i = 0; i < numObjects; i++) {
        const offsetByte = i * 16 * 4;
        matrices.push(new Float32Array(objectsMatrix.buffer, offsetByte, len));
    }
    const modelBuffers = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, modelBuffers);
    gl.bufferData(gl.ARRAY_BUFFER, objectsMatrix.byteLength, gl.DYNAMIC_DRAW);
    const posInfos = [];
    matrices.forEach(() => {
        posInfos.push({
            degX: degToRad(rand(0, 360)),
            degY: degToRad(rand(0, 360)),
            degZ: degToRad(rand(0, 360)),
            tX: rand(-1200, 1200),
            tY: rand(-1200, 1200),
            tZ: rand(-4200, -500),
        });
    });
    matrices.forEach((m, i) => {
        const { degX, degY, degZ, tX, tY, tZ } = posInfos[i];
        mat4.identity(m);
        mat4.translate(m, m, [tX, tY, tZ]);
        mat4.rotateX(m, m, degX);
        mat4.rotateY(m, m, degY);
        mat4.rotateZ(m, m, degZ);
    });
    //给attribute赋值，一个mat4相当于4个vec4
    for (let i = 0; i < 4; i++) {
        const loc = i + 3;
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 16 * 4, 16 * i);
        gl.vertexAttribDivisor(loc, 1);
    }
    const textures = [
        [gl.getUniformLocation(program, "materia.diffuse"), createImgTexture("./moon.jpg", requestAnimationFrame.bind(null, drawScene))],
        [gl.getUniformLocation(program, "materia.specular"), createImgTexture("./moon.jpg", requestAnimationFrame.bind(null, drawScene))],
    ];
    const woodTextures = [
        [gl.getUniformLocation(program, "materia.diffuse"), createImgTexture("./wood_floor.jpg", requestAnimationFrame.bind(null, drawScene))],
        [gl.getUniformLocation(program, "materia.specular"), createImgTexture("./wood_floor.jpg", requestAnimationFrame.bind(null, drawScene))],
    ];
    const STEP = 5;
    document.addEventListener("keydown", e => {
        switch (e.key.toUpperCase()) {
            case "W":
                cameraPos[1] += STEP;
                break;
            case "A":
                cameraPos[0] -= STEP;
                break;
            case "D":
                cameraPos[0] += STEP;
                break;
            case "S":
                cameraPos[1] -= STEP;
                break;
        }
        changeViewMat();
    });
    let prevTime = -1;
    function drawScene(time) {
        console.time("change pos by time");
        resizeCanvasToDisplaySize(canvas);
        gl.bindFramebuffer(gl.FRAMEBUFFER, extractBrightnessFramebuffer);
        // gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        //绘制天空盒
        gl.useProgram(skyboxProgram);
        gl.viewport(0, 0, canvasWidth, canvasHeight);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        setUniforms(spaceUniforms);
        bindVAO(spaceVAO);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, spaceTexture);
        gl.drawArrays(gl.TRIANGLES, 0, skyboxVertex.length / 2);
        //绘制几何体
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, modelBuffers);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, objectsMatrix);
        setUniforms(uniforms);
        setTextures(textures);
        gl.activeTexture(gl.TEXTURE0 + 5);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, spaceTexture);
        gl.uniform1i(demoSkyboxLoc, 5);
        bindVAO(objectVAO);
        // gl.drawArrays(gl.TRIANGLES, 0, earthV.length / 3)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, earthV.length / 3, numObjects);
        //将输出的attachment点位调回0
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        // 对亮色进行模糊处理, 图像绘制在纹理bloomResultTex中
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloomBlurFramebuffer1);
        gl.useProgram(bloomProgram);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, canvasWidth, canvasHeight);
        setTextures(bloomTextures);
        bindVAO(bloomVAO);
        let horizontal = 0;
        gl.uniform1i(horizontalLoc, horizontal);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        for (let i = 0; i < 5; i++) {
            const fbo = i % 2 ? bloomBlurFramebuffer1 : bloomBlurFramebuffer2;
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            const tex = i % 2 ? bloomResultTex2 : bloomResultTex1;
            horizontal = horizontal ? 0 : 1;
            gl.bindTexture(gl.TEXTURE_2D, tex);
            bindVAO(bloomVAO);
            gl.uniform1i(horizontalLoc, horizontal);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        //循环最后一次 5 % 2 = 1绘制到了bloomResultTex1上
        /* debug测试模糊效果
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        const tex = bloomResultTex1
        horizontal = horizontal ? 1 : 0
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        gl.viewport(0, 0, canvasWidth, canvasHeight)

        gl.bindTexture(gl.TEXTURE_2D, tex)
        bindVAO(bloomVAO)
        gl.uniform1i(horizontalLoc, horizontal)

        gl.drawArrays(gl.TRIANGLES, 0, 6) */
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, canvasWidth, canvasHeight);
        gl.useProgram(hdrProgram);
        bindVAO(bloomVAO);
        setTextures(hdrTextures);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        if (prevTime == -1) {
            prevTime = time;
        }
        console.timeEnd("change pos by time");
        requestAnimationFrame(drawScene);
        changePositionByTime(time - prevTime);
    }
    let oldTime = 0;
    function changePositionByTime(time) {
        const _oldTime = time;
        const deltaTime = time - oldTime;
        matrices.forEach((m, i) => {
            const posInfo = posInfos[i];
            posInfo.degX += degToRad(.3);
            posInfo.degY += degToRad(.3);
            posInfo.degZ += degToRad(.3);
            posInfo.tX -= deltaTime / 10;
            posInfo.tY -= deltaTime / 10;
            posInfo.tZ += deltaTime / 10;
            if (posInfo.tX <= -1200) {
                posInfo.degX = degToRad(rand(0, 360));
                posInfo.degY = degToRad(rand(0, 360));
                posInfo.degZ = degToRad(rand(0, 360));
                posInfo.tX = rand(100, 2200);
                posInfo.tY = rand(100, 1200);
                posInfo.tZ = rand(-3200, -200);
            }
            const { degX, degY, degZ, tX, tY, tZ } = posInfo;
            mat4.identity(m);
            mat4.translate(m, m, [tX, tY, tZ]);
            mat4.rotateX(m, m, degX);
            mat4.rotateY(m, m, degY);
            mat4.rotateZ(m, m, degZ);
        });
        oldTime = _oldTime;
        gl.bindBuffer(gl.ARRAY_BUFFER, modelBuffers);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, objectsMatrix);
    }
    function changeViewMat() {
        const camera = m4.lookAt(cameraPos, cameraTarget, [0, 1, 0]);
        viewMat[1] = m4.inverse(camera);
        spaceUniforms[0][1] = m4.inverse(m4.multiply(PERSPECTIVE_PROJECTION, viewMat[1]));
    }
}
function setUniforms(uniforms) {
    for (const [loc, v] of uniforms) {
        if (!Array.isArray(v)) {
            gl.uniform1f(loc, v);
        }
        else {
            switch (v.length) {
                case 1:
                    gl.uniform1f(loc, v[0]);
                    break;
                case 2:
                    gl.uniform2fv(loc, v);
                    break;
                case 3:
                    gl.uniform3fv(loc, v);
                    break;
                case 4:
                    gl.uniform4fv(loc, v);
                    break;
                default: gl.uniformMatrix4fv(loc, false, v);
            }
        }
    }
}
function setTextures(textures) {
    const len = textures.length;
    for (let i = 0; i < len; i++) {
        const [loc, texture] = textures[i];
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(loc, i);
    }
}
function createImgTexture(imgUrl, cb) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([120, 120, 120, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const img = new Image();
    img.src = imgUrl;
    img.addEventListener("load", () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        cb && cb();
    });
    return texture;
}
function createTexture(level, format, w, h, innerFormat, type, data) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, level, format, w, h, 0, innerFormat, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
}
function createCubeTexture(internalFormat, format, size, urls, cb) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);
    let imgLoadedCount = 0;
    for (let i = 0; i < 6; i++) {
        const binding = gl.TEXTURE_CUBE_MAP_POSITIVE_X + i;
        gl.texImage2D(binding, 0, internalFormat, size, size, 0, format, gl.UNSIGNED_BYTE, null);
        let url = urls && urls[i];
        if (url) {
            const img = new Image();
            img.src = url;
            img.addEventListener("load", () => {
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);
                gl.texImage2D(binding, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                imgLoadedCount++;
                if (imgLoadedCount == 6) {
                    cb && cb();
                }
            });
        }
    }
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
}
function createMSAAFramebuffer(w, h) {
    const fbo = gl.createFramebuffer();
    const rbo = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 4, gl.RGBA8, w, h);
    // 绑定到 fbo
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return {
        fbo,
        rbo
    };
}
function createFramebuffer(format, innerFormat, tex, w, h, type, depth) {
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const textures = [];
    for (let i = 0; i < tex; i++) {
        const tex = createTexture(0, format, w, h, innerFormat, type, null);
        textures.push(tex);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tex, 0);
    }
    if (depth) {
        const rbo = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo);
    }
    return {
        framebuffer: fb,
        textures
    };
}
function rand(low, high) {
    return Math.random() * (high - low) + low;
}
function createIndexBuffer(data) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data), gl.STATIC_DRAW);
    return buf;
}
function createVAO(infos) {
    const vao = gl.createVertexArray();
    if (!vao) {
        throw "创建vao失败";
    }
    gl.bindVertexArray(vao);
    const buffers = infos.map(info => {
        const { target, data } = info;
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(target ? target : gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        return buf;
    });
    const len = infos.length;
    for (let i = 0; i < len; i++) {
        let { target, location, size, program } = infos[i];
        const buf = buffers[i];
        target = target ? target : gl.ARRAY_BUFFER;
        size = size ? size : 3;
        const loc = typeof location === "string"
            ? gl.getAttribLocation(program, location)
            : location;
        gl.enableVertexAttribArray(loc);
        gl.bindBuffer(target, buf);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
    return vao;
}
function bindVAO(vao) {
    gl.bindVertexArray(vao);
}
function createBuffer(data, binding) {
    binding = binding ? binding : gl.ARRAY_BUFFER;
    const buf = gl.createBuffer();
    gl.bindBuffer(binding, buf);
    if (typeof data === "number") {
        gl.bufferData(binding, data, gl.DYNAMIC_DRAW);
    }
    else {
        gl.bufferData(binding, new Float32Array(data), gl.STATIC_DRAW);
    }
    return buf;
}
function createProgramFromScripts(name) {
    const v_shader = gl.createShader(gl.VERTEX_SHADER);
    const v_source = document.getElementById(name + "-vs").innerText;
    const f_shader = gl.createShader(gl.FRAGMENT_SHADER);
    const f_source = document.getElementById(name + "-fs").innerText;
    gl.shaderSource(v_shader, v_source);
    gl.compileShader(v_shader);
    if (!gl.getShaderParameter(v_shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(v_shader));
        throw "顶点编译着色器错误";
    }
    gl.shaderSource(f_shader, f_source);
    gl.compileShader(f_shader);
    if (!gl.getShaderParameter(f_shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(f_shader));
        throw "片段编译着色器错误";
    }
    const program = gl.createProgram();
    gl.attachShader(program, v_shader);
    gl.attachShader(program, f_shader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        throw "着色器出错";
    }
    return program;
}
function createUnusedTexture(depthTextureSize) {
    // 创建一个和深度纹理相同尺寸的颜色纹理
    const unusedTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, unusedTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, depthTextureSize, depthTextureSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // 把它附加到该帧缓冲上
    gl.framebufferTexture2D(gl.FRAMEBUFFER, // target
    gl.COLOR_ATTACHMENT0, // attachment point
    gl.TEXTURE_2D, // texture target
    unusedTexture, // texture
    0); // mip level
    return unusedTexture;
}
const w = 170;
const frontSide = [
    0, 0, 0,
    w, 0, 0,
    0, w, 0,
    0, w, 0,
    w, 0, 0,
    w, w, 0,
];
const topSide = [
    0, w, 0,
    w, w, 0,
    0, w, -w,
    0, w, -w,
    w, w, 0,
    w, w, -w,
];
const rightSide = [
    w, 0, 0,
    w, 0, -w,
    w, w, 0,
    w, w, 0,
    w, 0, -w,
    w, w, -w
];
const planeSize = 1000;
const planeVertex = [
    -planeSize, -200, planeSize,
    planeSize, -200, planeSize,
    -planeSize, -200, -planeSize,
    planeSize, -200, -planeSize,
];
const planeNormals = [
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
];
const planeCoord = [
    0, 0,
    1, 0,
    0, 1,
    1, 1,
];
const planeVertexIndexes = [
    0, 1, 2,
    2, 1, 3,
];
const cubeVertex = [
    ...frontSide,
    0, 0, -w,
    0, w, -w,
    w, 0, -w,
    w, 0, -w,
    0, w, -w,
    w, w, -w,
    ...topSide,
    0, 0, 0,
    0, 0, -w,
    w, 0, 0,
    w, 0, 0,
    0, 0, -w,
    w, 0, -w,
    ...rightSide,
    0, 0, 0,
    0, w, 0,
    0, 0, -w,
    0, 0, -w,
    0, w, 0,
    0, w, -w
];
const cubeNormals = [
    //front
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    //back
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    //top
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    //bottom
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    //right
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    //left
    -1, 0, 0,
    -1, 0, 0,
    -1, 0, 0,
    -1, 0, 0,
    -1, 0, 0,
    -1, 0, 0,
];
const cubeCoord = [
    //front
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1,
    //back
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1,
    //top
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1,
    //bottom
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1,
    //right
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1,
    //left
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1,
];
const skyboxVertex = [
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1,
];
const skyboxCoord = [
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1
];
function subtractVectors(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function normalize(v) {
    var length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    // make sure we don't divide by 0.
    if (length > 0.00001) {
        return [v[0] / length, v[1] / length, v[2] / length];
    }
    else {
        return [0, 0, 0];
    }
}
function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]];
}
function radToDeg(r) {
    return r * 180 / Math.PI;
}
function degToRad(d) {
    return d * Math.PI / 180;
}
function loadObjFileFromStr(str) {
    // const v: number[] = []
    // const vt: number[] = []
    // const vn: number[] = []
    // const vIndexes: number[] = []
    // const vtIndexes: number[] = []
    // const vnIndexes: number[] = []
    // const rows = str.split("\n")
    // const V_RE = /(v[t|n]?) ([-+]?\d+(?:.\d*)?) ([-+]?\d+(?:.\d*)?)(?: ([-+]?\d+(?:.\d*)?))?/
    // const F_RE = /f (\d+\/\d+\/\d+) (\d+\/\d+\/\d+) (\d+\/\d+\/\d+)/
    // for (const row of rows) {
    // 	const matchV = V_RE.exec(row)
    // 	const matchF = F_RE.exec(row)
    // 	if (matchV) {
    // 		const [, target, n1, n2, n3] = matchV
    // 		switch (target) {
    // 			case "v":
    // 				v.push(Number(n1), Number(n2), Number(n3))
    // 				break
    // 			case "vt":
    // 				vt.push(Number(n1), Number(n2))
    // 				break
    // 			case "vn":
    // 				vn.push(Number(n1), Number(n2), Number(n3))
    // 				break
    // 		}
    // 	} else if (matchF) {
    // 		const [, ndx1, ndx2, ndx3] = matchF
    // 		const [v1, t1, n1] = ndx1.split("/").map(Number)
    // 		const [v2, t2, n2] = ndx2.split("/").map(Number)
    // 		const [v3, t3, n3] = ndx3.split("/").map(Number)
    // 		vIndexes.push(v1 - 1, v2 - 1, v3 - 1)
    // 		vtIndexes.push(t1 - 1, t2 - 1, t3 - 1)
    // 		vnIndexes.push(n1 - 1, n2 - 1, n3 - 1)
    // 	}
    // }
    // return {
    // 	v, vt, vn,
    // 	vIndexes,
    // 	vnIndexes,
    // 	vtIndexes,
    // }
    // because indices are base 1 let's just fill in the 0th data
    const objPositions = [[0, 0, 0]];
    const objTexcoords = [[0, 0]];
    const objNormals = [[0, 0, 0]];
    // same order as `f` indices
    const objVertexData = [
        objPositions,
        objTexcoords,
        objNormals,
    ];
    // same order as `f` indices
    let webglVertexData = [
        [],
        [],
        [],
    ];
    function addVertex(vert) {
        const ptn = vert.split('/');
        ptn.forEach((objIndexStr, i) => {
            if (!objIndexStr) {
                return;
            }
            const objIndex = parseInt(objIndexStr);
            const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
            webglVertexData[i].push(...objVertexData[i][index]);
        });
    }
    const keywords = {
        v(parts) {
            objPositions.push(parts.map(parseFloat));
        },
        vn(parts) {
            objNormals.push(parts.map(parseFloat));
        },
        vt(parts) {
            // should check for missing v and extra w?
            objTexcoords.push(parts.map(parseFloat));
        },
        f(parts) {
            const numTriangles = parts.length - 2;
            for (let tri = 0; tri < numTriangles; ++tri) {
                addVertex(parts[0]);
                addVertex(parts[tri + 1]);
                addVertex(parts[tri + 2]);
            }
        },
    };
    const keywordRE = /(\w*)(?: )*(.*)/;
    const lines = str.split('\n');
    for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
        const line = lines[lineNo].trim();
        if (line === '' || line.startsWith('#')) {
            continue;
        }
        const m = keywordRE.exec(line);
        if (!m) {
            continue;
        }
        const [, keyword, unparsedArgs] = m;
        const parts = line.split(/\s+/).slice(1);
        const handler = keywords[keyword];
        if (!handler) {
            console.warn('unhandled keyword:', keyword); // eslint-disable-line no-console
            continue;
        }
        handler(parts, unparsedArgs);
    }
    return {
        position: webglVertexData[0],
        texcoord: webglVertexData[1],
        normal: webglVertexData[2],
    };
}
const m4 = {
    lookAt: function (cameraPosition, target, up) {
        var zAxis = normalize(subtractVectors(cameraPosition, target));
        var xAxis = normalize(cross(up, zAxis));
        var yAxis = normalize(cross(zAxis, xAxis));
        return [
            xAxis[0], xAxis[1], xAxis[2], 0,
            yAxis[0], yAxis[1], yAxis[2], 0,
            zAxis[0], zAxis[1], zAxis[2], 0,
            cameraPosition[0],
            cameraPosition[1],
            cameraPosition[2],
            1,
        ];
    },
    perspective: function (fieldOfViewInRadians, aspect, near, far) {
        let f = 1 / Math.tan(0.5 * fieldOfViewInRadians);
        let rangeInv = 1.0 / (near - far);
        return [
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (near + far) * rangeInv, -1,
            0, 0, near * far * rangeInv * 2, 0
        ];
    },
    projection: function (width, height, depth) {
        // Note: This matrix flips the Y axis so 0 is at the top.
        return [
            2 / width, 0, 0, 0,
            0, -2 / height, 0, 0,
            0, 0, 2 / depth, 0,
            -1, 1, 0, 1,
        ];
    },
    orthographic(l, r, b, t, n, f) {
        n = -n;
        f = -f;
        return [
            2 / (r - l), 0, 0, 0,
            0, 2 / (b - t), 0, 0,
            0, 0, 2 / (n - f), 0,
            (r + l) / (l - r), (t + b) / (t - b), (f + n) / (f - n), 1
        ];
    },
    multiply: function (a, b) {
        let a00 = a[0 * 4 + 0];
        let a01 = a[0 * 4 + 1];
        let a02 = a[0 * 4 + 2];
        let a03 = a[0 * 4 + 3];
        let a10 = a[1 * 4 + 0];
        let a11 = a[1 * 4 + 1];
        let a12 = a[1 * 4 + 2];
        let a13 = a[1 * 4 + 3];
        let a20 = a[2 * 4 + 0];
        let a21 = a[2 * 4 + 1];
        let a22 = a[2 * 4 + 2];
        let a23 = a[2 * 4 + 3];
        let a30 = a[3 * 4 + 0];
        let a31 = a[3 * 4 + 1];
        let a32 = a[3 * 4 + 2];
        let a33 = a[3 * 4 + 3];
        let b00 = b[0 * 4 + 0];
        let b01 = b[0 * 4 + 1];
        let b02 = b[0 * 4 + 2];
        let b03 = b[0 * 4 + 3];
        let b10 = b[1 * 4 + 0];
        let b11 = b[1 * 4 + 1];
        let b12 = b[1 * 4 + 2];
        let b13 = b[1 * 4 + 3];
        let b20 = b[2 * 4 + 0];
        let b21 = b[2 * 4 + 1];
        let b22 = b[2 * 4 + 2];
        let b23 = b[2 * 4 + 3];
        let b30 = b[3 * 4 + 0];
        let b31 = b[3 * 4 + 1];
        let b32 = b[3 * 4 + 2];
        let b33 = b[3 * 4 + 3];
        return [
            b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30,
            b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31,
            b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32,
            b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33,
            b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30,
            b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31,
            b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32,
            b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33,
            b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30,
            b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31,
            b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32,
            b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33,
            b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30,
            b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31,
            b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32,
            b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33,
        ];
    },
    inverse: function (m) {
        var m00 = m[0 * 4 + 0];
        var m01 = m[0 * 4 + 1];
        var m02 = m[0 * 4 + 2];
        var m03 = m[0 * 4 + 3];
        var m10 = m[1 * 4 + 0];
        var m11 = m[1 * 4 + 1];
        var m12 = m[1 * 4 + 2];
        var m13 = m[1 * 4 + 3];
        var m20 = m[2 * 4 + 0];
        var m21 = m[2 * 4 + 1];
        var m22 = m[2 * 4 + 2];
        var m23 = m[2 * 4 + 3];
        var m30 = m[3 * 4 + 0];
        var m31 = m[3 * 4 + 1];
        var m32 = m[3 * 4 + 2];
        var m33 = m[3 * 4 + 3];
        var tmp_0 = m22 * m33;
        var tmp_1 = m32 * m23;
        var tmp_2 = m12 * m33;
        var tmp_3 = m32 * m13;
        var tmp_4 = m12 * m23;
        var tmp_5 = m22 * m13;
        var tmp_6 = m02 * m33;
        var tmp_7 = m32 * m03;
        var tmp_8 = m02 * m23;
        var tmp_9 = m22 * m03;
        var tmp_10 = m02 * m13;
        var tmp_11 = m12 * m03;
        var tmp_12 = m20 * m31;
        var tmp_13 = m30 * m21;
        var tmp_14 = m10 * m31;
        var tmp_15 = m30 * m11;
        var tmp_16 = m10 * m21;
        var tmp_17 = m20 * m11;
        var tmp_18 = m00 * m31;
        var tmp_19 = m30 * m01;
        var tmp_20 = m00 * m21;
        var tmp_21 = m20 * m01;
        var tmp_22 = m00 * m11;
        var tmp_23 = m10 * m01;
        var t0 = (tmp_0 * m11 + tmp_3 * m21 + tmp_4 * m31) -
            (tmp_1 * m11 + tmp_2 * m21 + tmp_5 * m31);
        var t1 = (tmp_1 * m01 + tmp_6 * m21 + tmp_9 * m31) -
            (tmp_0 * m01 + tmp_7 * m21 + tmp_8 * m31);
        var t2 = (tmp_2 * m01 + tmp_7 * m11 + tmp_10 * m31) -
            (tmp_3 * m01 + tmp_6 * m11 + tmp_11 * m31);
        var t3 = (tmp_5 * m01 + tmp_8 * m11 + tmp_11 * m21) -
            (tmp_4 * m01 + tmp_9 * m11 + tmp_10 * m21);
        var d = 1.0 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);
        return [
            d * t0,
            d * t1,
            d * t2,
            d * t3,
            d * ((tmp_1 * m10 + tmp_2 * m20 + tmp_5 * m30) -
                (tmp_0 * m10 + tmp_3 * m20 + tmp_4 * m30)),
            d * ((tmp_0 * m00 + tmp_7 * m20 + tmp_8 * m30) -
                (tmp_1 * m00 + tmp_6 * m20 + tmp_9 * m30)),
            d * ((tmp_3 * m00 + tmp_6 * m10 + tmp_11 * m30) -
                (tmp_2 * m00 + tmp_7 * m10 + tmp_10 * m30)),
            d * ((tmp_4 * m00 + tmp_9 * m10 + tmp_10 * m20) -
                (tmp_5 * m00 + tmp_8 * m10 + tmp_11 * m20)),
            d * ((tmp_12 * m13 + tmp_15 * m23 + tmp_16 * m33) -
                (tmp_13 * m13 + tmp_14 * m23 + tmp_17 * m33)),
            d * ((tmp_13 * m03 + tmp_18 * m23 + tmp_21 * m33) -
                (tmp_12 * m03 + tmp_19 * m23 + tmp_20 * m33)),
            d * ((tmp_14 * m03 + tmp_19 * m13 + tmp_22 * m33) -
                (tmp_15 * m03 + tmp_18 * m13 + tmp_23 * m33)),
            d * ((tmp_17 * m03 + tmp_20 * m13 + tmp_23 * m23) -
                (tmp_16 * m03 + tmp_21 * m13 + tmp_22 * m23)),
            d * ((tmp_14 * m22 + tmp_17 * m32 + tmp_13 * m12) -
                (tmp_16 * m32 + tmp_12 * m12 + tmp_15 * m22)),
            d * ((tmp_20 * m32 + tmp_12 * m02 + tmp_19 * m22) -
                (tmp_18 * m22 + tmp_21 * m32 + tmp_13 * m02)),
            d * ((tmp_18 * m12 + tmp_23 * m32 + tmp_15 * m02) -
                (tmp_22 * m32 + tmp_14 * m02 + tmp_19 * m12)),
            d * ((tmp_22 * m22 + tmp_16 * m02 + tmp_21 * m12) -
                (tmp_20 * m12 + tmp_23 * m22 + tmp_17 * m02))
        ];
    },
    identity: function () {
        return [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ];
    },
    translation: function (tx, ty, tz) {
        return [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            tx, ty, tz, 1,
        ];
    },
    xRotation: function (angleInRadians) {
        let c = Math.cos(angleInRadians);
        let s = Math.sin(angleInRadians);
        return [
            1, 0, 0, 0,
            0, c, s, 0,
            0, -s, c, 0,
            0, 0, 0, 1,
        ];
    },
    yRotation: function (angleInRadians) {
        let c = Math.cos(angleInRadians);
        let s = Math.sin(angleInRadians);
        return [
            c, 0, -s, 0,
            0, 1, 0, 0,
            s, 0, c, 0,
            0, 0, 0, 1,
        ];
    },
    zRotation: function (angleInRadians) {
        let c = Math.cos(angleInRadians);
        let s = Math.sin(angleInRadians);
        return [
            c, s, 0, 0,
            -s, c, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ];
    },
    scaling: function (sx, sy, sz) {
        return [
            sx, 0, 0, 0,
            0, sy, 0, 0,
            0, 0, sz, 0,
            0, 0, 0, 1,
        ];
    },
    translate: function (m, tx, ty, tz) {
        return m4.multiply(m, m4.translation(tx, ty, tz));
    },
    xRotate: function (m, angleInRadians) {
        return m4.multiply(m, m4.xRotation(angleInRadians));
    },
    yRotate: function (m, angleInRadians) {
        return m4.multiply(m, m4.yRotation(angleInRadians));
    },
    zRotate: function (m, angleInRadians) {
        return m4.multiply(m, m4.zRotation(angleInRadians));
    },
    scale: function (m, sx, sy, sz) {
        return m4.multiply(m, m4.scaling(sx, sy, sz));
    },
};
const { position: earthV, texcoord: earthTexcoord, normal: earthNormals, } = loadObjFileFromStr(`# Blender v2.93.4 OBJ File: ''
# www.blender.org
mtllib leaves.mtl
o 立方体
v -12.803289 -2.589929 -13.601162
v -63.642166 2.014972 -13.318207
v -64.560219 -3.640312 19.400272
v -32.599365 4.117333 33.574448
v 34.627762 -1.501630 -10.810241
v 48.417351 5.240402 -32.476902
v 3.481361 -2.538538 13.441588
v 34.592453 1.072944 2.178738
vt 0.625000 0.000000
vt 0.375000 0.000000
vt 0.375000 0.250000
vt 0.625000 0.250000
vt 0.375000 0.500000
vt 0.625000 0.500000
vt 0.375000 0.750000
vt 0.625000 0.750000
vt 0.375000 1.000000
vt 0.125000 0.500000
vt 0.125000 0.750000
vt 0.875000 0.500000
vt 0.625000 1.000000
vt 0.875000 0.750000
vn -0.0898 -0.9810 -0.1721
vn 0.0492 -0.9187 0.3919
vn 0.1814 -0.9646 0.1917
vn 0.0382 -0.9608 -0.2747
vn 0.0155 -0.9999 -0.0075
vn 0.1221 0.9785 0.1664
vn -0.2972 0.9422 0.1545
vn 0.3442 -0.5128 0.7865
vn 0.6190 -0.7701 0.1543
vn -0.0765 -0.8085 -0.5835
vn 0.0237 -0.9996 -0.0123
vn -0.0327 0.9992 -0.0231
usemtl None
s off
f 2/1/1 1/2/1 3/3/1
f 4/4/2 3/3/2 7/5/2
f 8/6/3 7/5/3 5/7/3
f 6/8/4 5/7/4 1/9/4
f 7/5/5 3/10/5 1/11/5
f 4/12/6 8/6/6 6/8/6
f 2/1/7 3/3/7 4/4/7
f 4/4/8 7/5/8 8/6/8
f 8/6/9 5/7/9 6/8/9
f 6/8/10 1/9/10 2/13/10
f 7/5/11 1/11/11 5/7/11
f 4/12/12 6/8/12 2/14/12
`);
main();
