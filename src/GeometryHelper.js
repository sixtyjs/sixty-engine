'use strict';

var Vec3 = require('famous-math').Vec3;
var Vec2 = require('famous-math').Vec2;

var outputs = [
    new Vec3(),
    new Vec3(),
    new Vec3()
];

/**
 * A helper object used to calculate buffers for complicated geometries.
 * Tailored for the WebGLRenderer, used by most primitives.
 *
 * @static
 * @class GeometryHelper
 */

var GeometryHelper = {};

/**
 * A function that iterates through vertical and horizontal slices
 * based on input detail, and generates vertices and indices for each
 * subdivision.
 *
 * @static
 * @method generateParametric
 *
 * @param {Number} amount of slices to iterate through
 * @param {Number} amount of stacks to iterate through
 * @param {Function} function used to generate vertex positions at each point
 */

GeometryHelper.generateParametric = function generateParametric(detailX, detailY, func) {
    var vertices = [],
        i, theta, phi, result, j;

    // We must wrap around slightly more than once for uv coordinates to look correct.

    // var Xrange = Math.PI + (Math.PI / detailX);
    var Xrange = Math.PI;
    var out = [];

    for (i = 0; i < detailX + 1; i++) {
        theta = i * Xrange / detailX;
        for (j = 0; j < detailY; j++) {
            phi = j * 2.0 * Xrange / detailY;
            func(theta, phi, out);
            vertices.push(out[0], out[1], out[2]);
        }
    }

    var indices = [],
        v = 0,
        next;
    for (i = 0; i < detailX; i++) {
        for (j = 0; j < detailY; j++) {
            next = (j + 1) % detailY;
            indices.push(v + j, v + next, v + j + detailY);
            indices.push(v + next, v + next + detailY, v + j + detailY);
        }
        v += detailY;
    }

    return {
        vertices: vertices,
        indices: indices
    };
}

/**
 * Calculates normals belonging to each face of a geometry.  
 * Assumes clockwise declaration of vertices.
 *
 * @static
 * @method computeNormals
 *
 * @param {Array} indices declaring faces of geometry
 * @param {Array} vertices of all points on the geometry
 * @param {Array} array to be filled and returned
 * 
 * @return {Array} calculated face normals
 */

GeometryHelper.computeNormals = function computeNormals(vertices, indices, out) {
    var normals = out || [];
    var vertexThree;
    var vertexTwo;
    var vertexOne;
    var indexOne;
    var indexTwo;
    var indexThree;
    var start;
    var end;
    var normal;
    var j;
    var len = indices.length / 3;

    for (var i = 0; i < len; i++) {
        j = i * 3;
        indexOne = indices[j + 0] * 3;
        indexTwo = indices[j + 1] * 3;
        indexThree = indices[j + 2] * 3;

        outputs[0].set(vertices[indexOne], vertices[indexOne + 1], vertices[indexOne + 2]);
        outputs[1].set(vertices[indexTwo], vertices[indexTwo + 1], vertices[indexTwo + 2]);
        outputs[2].set(vertices[indexThree], vertices[indexThree + 1], vertices[indexThree + 2]);

        normal = outputs[1].subtract(outputs[0]).cross(outputs[2].subtract(outputs[0]));
        normal = normal.normalize().toArray();

        normals[indexOne + 0] = normal[0];
        normals[indexOne + 1] = normal[1];
        normals[indexOne + 2] = normal[2];

        normals[indexTwo + 0] = normal[0];
        normals[indexTwo + 1] = normal[1];
        normals[indexTwo + 2] = normal[2];

        normals[indexThree + 0] = normal[0];
        normals[indexThree + 1] = normal[1];
        normals[indexThree + 2] = normal[2];
    }

    return normals;
};

/**
 * Divides all inserted triangles into four sub-triangles. Alters the
 * passed in arrays.
 *
 * @static
 * @method subdivide
 *
 * @param {Array} indices declaring faces of geometry
 * @param {Array} vertices of all points on the geometry
 * @param {Array} texture coordinates of all points on the geometry
 * 
 */

GeometryHelper.subdivide = function subdivide(indices, vertices, textureCoords) {
    var triangleIndex = indices.length / 3,
        abc,
        face,
        i, j, k, pos, tex;

    while (triangleIndex--) {
        face = indices.slice(triangleIndex * 3, triangleIndex * 3 + 3);

        pos = face.map(function(vertIndex) {
            return new Vec3(vertices[vertIndex * 3], vertices[vertIndex * 3 + 1], vertices[vertIndex * 3 + 2]);
        });
        vertices.push.apply(vertices, Vec3.scale(Vec3.add(pos[0], pos[1], outputs[0]), 0.5, outputs[1]).toArray());
        vertices.push.apply(vertices, Vec3.scale(Vec3.add(pos[1], pos[2], outputs[0]), 0.5, outputs[1]).toArray());
        vertices.push.apply(vertices, Vec3.scale(Vec3.add(pos[0], pos[2], outputs[0]), 0.5, outputs[1]).toArray());

        if (textureCoords) {
            tex = face.map(function(vertIndex) {
                return new Vec2(textureCoords[vertIndex * 2], textureCoords[vertIndex * 2 + 1]);
            });
            textureCoords.push.apply(textureCoords, Vec2.scale(Vec2.add(tex[0], tex[1], outputs[0]), 0.5, outputs[1]).toArray());
            textureCoords.push.apply(textureCoords, Vec2.scale(Vec2.add(tex[1], tex[2], outputs[0]), 0.5, outputs[1]).toArray());
            textureCoords.push.apply(textureCoords, Vec2.scale(Vec2.add(tex[0], tex[2], outputs[0]), 0.5, outputs[1]).toArray());
        }

        i = vertices.length - 3, j = i + 1, k = i + 2;
        indices.push(i, j, k);
        indices.push(face[0], i, k);
        indices.push(i, face[1], j);
        indices[triangleIndex] = k;
        indices[triangleIndex + 1] = j;
        indices[triangleIndex + 2] = face[2];
    }
};

/**
 * Creates duplicate of vertices that are shared between faces.
 * Alters the input vertex and index arrays.
 *
 * @static
 * @method getUniqueFaces
 *
 * @param {Array} vertices of all points on the geometry
 * @param {Array} indices declaring faces of geometry
 * 
 */

GeometryHelper.getUniqueFaces = function getUniqueFaces(vertices, indices) {
    var triangleIndex = indices.length / 3,
        registered = [],
        index;

    while (triangleIndex--) {
        for (var i = 0; i < 3; i++) {

            index = indices[triangleIndex * 3 + i];

            if (registered[index]) {
                vertices.push(vertices[index * 3], vertices[index * 3 + 1], vertices[index * 3 + 2]);
                indices[triangleIndex * 3 + i] = vertices.length / 3 - 1;
            } else {
                registered[index] = true;
            }
        }
    }
};

/**
 * Divides all inserted triangles into four sub-triangles while maintaining
 * a radius of one. Alters the passed in arrays.
 *
 * @static
 * @method subdivide
 *
 * @param {Array} vertices of all points on the geometry
 * @param {Array} indices declaring faces of geometry
 * 
 */

GeometryHelper.subdivideSpheroid = function subdivideSpheroid(vertices, indices) {
    var triangleIndex = indices.length / 3,
        abc,
        face,
        i, j, k;

    while (triangleIndex--) {
        face = indices.slice(triangleIndex * 3, triangleIndex * 3 + 3);
        abc = face.map(function(vertIndex) {
            return new Vec3(vertices[vertIndex * 3], vertices[vertIndex * 3 + 1], vertices[vertIndex * 3 + 2]);
        });

        vertices.push.apply(vertices, Vec3.normalize(Vec3.add(abc[0], abc[1], outputs[0]), outputs[1]).toArray());
        vertices.push.apply(vertices, Vec3.normalize(Vec3.add(abc[1], abc[2], outputs[0]), outputs[1]).toArray());
        vertices.push.apply(vertices, Vec3.normalize(Vec3.add(abc[0], abc[2], outputs[0]), outputs[1]).toArray());

        i = vertices.length / 3 - 3, j = i + 1, k = i + 2;

        indices.push(i, j, k);
        indices.push(face[0], i, k);
        indices.push(i, face[1], j);
        indices[triangleIndex * 3] = k;
        indices[triangleIndex * 3 + 1] = j;
        indices[triangleIndex * 3 + 2] = face[2];
    }
};

/**
 * Divides all inserted triangles into four sub-triangles while maintaining
 * a radius of one. Alters the passed in arrays.
 *
 * @static
 * @method getSpheroidNormals
 *
 * @param {Array} vertices of all points on the geometry
 * 
 * @return {Array} new list of calculated normals.
 */

GeometryHelper.getSpheroidNormals = function getSpheroidNormals(vertices, out) {
    var out = out || [];
    var length = vertices.length / 3;
    var normalized;

    for(var i = 0; i < length; i++) {
        normalized = new Vec3(
            vertices[i * 3 + 0],
            vertices[i * 3 + 1],
            vertices[i * 3 + 2]
        ).normalize().toArray();

        out[i * 3 + 0] = normalized[0];
        out[i * 3 + 1] = normalized[1];
        out[i * 3 + 2] = normalized[2];
    }

    return out;
};

/**
 * Calculates texture coordinates for spheroid primitives based on
 * input vertices.
 *
 * @static
 * @method getSpheroidUV
 *
 * @param {Array} vertices of all points on the geometry
 * 
 * @return {Array} new list of calculated texture coordinates
 */

GeometryHelper.getSpheroidUV = function getSpheroidUV(vertices, out) {
    var out = out || [];
    var length = vertices.length / 3;
    var vertex;

    for(var i = 0; i < length; i++) {
        vertex = vertices.slice(i * 3, i * 3 + 3);
        out.push(
            this.azimuth(vertex) * 0.5 / Math.PI + 0.5,
            this.altitude(vertex) / Math.PI + 0.5
        );
    }

    return out;
};

/**
 * Iterates through and normalizes a list of vertices.
 *
 * @static
 * @method normalizeAll
 *
 * @param {Array} vertices of all points on the geometry
 * 
 * @return {Array} new list of normalized vertices
 */

GeometryHelper.normalizeAll = function normalizeAll(vertices, out) {
    var out = out || [];
    var vertex;
    var len = vertices.length / 3;

    for (var i = 0; i < len; i++) {
        Array.prototype.push.apply(out, new Vec3(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]).normalize().toArray());
    }

    return out;
};

GeometryHelper.azimuth = function azimuth(v) {
    return Math.atan2(v[2], -v[0]);
};

// Angle above the XZ plane.
GeometryHelper.altitude = function inclination(v) {
    return Math.atan2(-v[1], Math.sqrt((v[0] * v[0]) + (v[2] * v[2])));
};

/**
 * Converts a list of indices from 'triangle' to 'line' format.
 *
 * @static
 * @method trianglesToLines
 *
 * @param {Array} indices of all faces on the geometry
 * 
 * @return {Array} new list of line-formatted indices
 */

GeometryHelper.trianglesToLines = function triangleToLines(indices, out) {
    var out = [];
    var face;
    var j;
    var i;

    for (i = 0; i < indices.length; i++) {
        out.push(indices[i][0], indices[i][1]);
        out.push(indices[i][1], indices[i][2]);
        out.push(indices[i][2], indices[i][0]);
    }

    return out;
};

module.exports = GeometryHelper;
